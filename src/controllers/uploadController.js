// const prisma = require("../config/db");

const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
exports.uploadResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        
        const fileStream = fs.createReadStream(req.file.path);
        const formData = new FormData();
        formData.append("resume_file", fileStream, req.file.originalname);
        
        // Send request to FastAPI
        const response = await axios.post(
            "https://3d37f9c1-2295-4b9e-8f45-a2a118e7be19-00-27r26q9d5zekl.pike.replit.dev/parse/resume",
            formData,
            { headers: { ...formData.getHeaders() } }
        );
        
        // Safe file deletion
        try { fs.unlinkSync(req.file.path); } catch (err) {
            console.warn("Failed to delete uploaded file:", err.message);
        }
        
        // Transform API response to match Prisma schema
        const parsedData = response.data;
        const resumeData = {
            name: parsedData.name || "Unknown",
            email: parsedData.email || "",
            phone: parsedData.phone || "",
            technicalSkills: parsedData.technical_skills || [],
            softSkills: parsedData.soft_skills || [],
            experience: parsedData.experience ? parsedData.experience.job_roles.map(role =>
                `${role.title} at ${role.company} (${role.duration})`
            ) : [],
            education: parsedData.education ? parsedData.education.degrees : [],
            projects: parsedData.projects ? parsedData.projects.map(proj =>
                `${proj.name} - ${proj.description}`
            ) : []
        };
        
        // Save transformed resume data to DB
        const savedResume = await prisma.resume.create({
            data: resumeData,
        });
        
        try {
            console.log("Resume saved successfully, attempting to match with jobs");
            
            // First, let's ensure we have valid data to send
            const skills = resumeData.technicalSkills && resumeData.technicalSkills.length > 0 
                ? resumeData.technicalSkills.join(',') 
                : '';
            const experience = resumeData.experience && resumeData.experience.length > 0 
                ? resumeData.experience.join(',') 
                : '';
            const projects = resumeData.projects && resumeData.projects.length > 0 
                ? resumeData.projects.join(',') 
                : '';
            const education = resumeData.education && resumeData.education.length > 0 
                ? resumeData.education.join(',') 
                : '';
            
            console.log("Sending match request with data:", {
                resumeId: savedResume.id,
                skills: skills.slice(0, 50) + (skills.length > 50 ? '...' : ''),
                experience: experience.slice(0, 50) + (experience.length > 50 ? '...' : ''),
                projects: projects.slice(0, 50) + (projects.length > 50 ? '...' : ''),
                education: education.slice(0, 50) + (education.length > 50 ? '...' : '')
            });
            
            // Try using POST instead of GET for the matching API
            const matchResponse = await axios.post(
                `https://03ad-2401-4900-7b3f-f001-41b5-ffc5-8fe6-8cca.ngrok-free.app `,
                {
                    resumeId: savedResume.id,
                    skills,
                    experience,
                    projects,
                    education
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            
            console.log("Match API response received:", 
                        matchResponse.data.success ? "Success" : "Failed", 
                        "Matches found:", matchResponse.data.matches ? matchResponse.data.matches.length : 0);
            
            if (matchResponse.data && matchResponse.data.success && Array.isArray(matchResponse.data.matches)) {
                // Find the best match (highest score)
                let bestMatch = null;
                let bestMatchJob = null;
                
                // Find the best matching job
                for (const match of matchResponse.data.matches) {
                    console.log("Checking match with skills:", match.required_skills ? match.required_skills.length : 0, 
                                "Score:", match.total_score);
                    
                    if (!match.required_skills || !Array.isArray(match.required_skills) || match.required_skills.length === 0) {
                        console.warn("Match is missing required_skills array, skipping");
                        continue;
                    }
                    
                    try {
                        const jobDescription = await prisma.jobDescription.findFirst({
                            where: {
                                requiredSkills: {
                                    hasSome: match.required_skills
                                }
                            }
                        });
                        
                        console.log("Job match query result:", jobDescription ? `Found job ID ${jobDescription.id}` : "No job found");
                        
                        if (jobDescription && (!bestMatch || match.total_score > bestMatch.total_score)) {
                            bestMatch = match;
                            bestMatchJob = jobDescription;
                            console.log("New best match found, score:", match.total_score, "Job ID:", jobDescription.id);
                        }
                    } catch (jobQueryError) {
                        console.error("Error querying job database:", jobQueryError.message);
                    }
                }
                
                if (bestMatch && bestMatchJob) {
                    console.log("Best match determined. Creating leaderboard entry with data:", {
                        jobId: bestMatchJob.id,
                        resumeId: savedResume.id, 
                        candidateName: resumeData.name,
                        candidateEmail: resumeData.email,
                        score: bestMatch.total_score
                    });
                    
                    try {
                        // Create leaderboard entry for the best match with explicit error handling
                        const leaderboardEntry = await prisma.leaderboard.create({
                            data: {
                                jobId: bestMatchJob.id,
                                resumeId: savedResume.id,
                                candidateName: resumeData.name,
                                candidateEmail: resumeData.email,
                                score: bestMatch.total_score
                            }
                        });
                        
                        console.log("Leaderboard entry created successfully with ID:", leaderboardEntry.id);
                        
                        // Return success with resume and match information
                        res.status(201).json({
                            resume: savedResume,
                            matches: 1,
                            leaderboardId: leaderboardEntry.id,
                            message: `Resume uploaded and matched with the best job opportunity`
                        });
                    } catch (leaderboardError) {
                        console.error("Failed to create leaderboard entry:", leaderboardError.message);
                        
                        // If leaderboard creation fails, still return partial success
                        res.status(201).json({
                            resume: savedResume,
                            matches: 1,
                            message: `Resume uploaded and matched with job, but failed to create leaderboard entry: ${leaderboardError.message}`
                        });
                    }
                } else {
                    // If no valid match found
                    console.log("No valid matches found after processing all potential matches");
                    res.status(201).json({
                        resume: savedResume,
                        message: "Resume uploaded successfully, but no valid job matches found"
                    });
                }
            } else {
                // If matching response is invalid, still return success for the resume upload
                console.warn("Invalid match response format:", JSON.stringify(matchResponse.data).substring(0, 100) + "...");
                res.status(201).json({
                    resume: savedResume,
                    message: "Resume uploaded successfully, but matching data was invalid"
                });
            }
        } catch (matchError) {
            console.error("Error with matching API:", matchError.message);
            
            if (matchError.response) {
                console.error("API error details:", {
                    status: matchError.response.status,
                    data: matchError.response.data
                });
            }
            
            // Try a fallback approach - query job descriptions directly
            try {
                console.log("Attempting fallback - direct database matching");
                
                // Get all jobs that match at least one technical skill
                if (resumeData.technicalSkills && resumeData.technicalSkills.length > 0) {
                    const matchingJobs = await prisma.jobDescription.findMany({
                        where: {
                            requiredSkills: {
                                hasSome: resumeData.technicalSkills
                            }
                        }
                    });
                    
                    console.log(`Found ${matchingJobs.length} potential matching jobs via direct database query`);
                    
                    if (matchingJobs.length > 0) {
                        // Calculate a simple matching score based on skill overlap
                        const jobMatches = matchingJobs.map(job => {
                            const matchingSkills = job.requiredSkills.filter(skill => 
                                resumeData.technicalSkills.includes(skill)
                            );
                            
                            const score = (matchingSkills.length / job.requiredSkills.length) * 100;
                            
                            return {
                                job,
                                score,
                                matchingSkills
                            };
                        });
                        
                        // Sort by score (highest first)
                        jobMatches.sort((a, b) => b.score - a.score);
                        
                        // Take the best match
                        const bestMatch = jobMatches[0];
                        
                        console.log(`Best direct match has score ${bestMatch.score.toFixed(2)}% with ${bestMatch.matchingSkills.length} matching skills`);
                        
                        // Create leaderboard entry
                        try {
                            const leaderboardEntry = await prisma.leaderboard.create({
                                data: {
                                    jobId: bestMatch.job.id,
                                    resumeId: savedResume.id,
                                    candidateName: resumeData.name,
                                    candidateEmail: resumeData.email,
                                    score: bestMatch.score
                                }
                            });
                            
                            console.log("Leaderboard entry created via fallback method with ID:", leaderboardEntry.id);
                            
                            res.status(201).json({
                                resume: savedResume,
                                matches: 1,
                                leaderboardId: leaderboardEntry.id,
                                message: `Resume uploaded and matched with job using fallback method. Score: ${bestMatch.score.toFixed(2)}%`
                            });
                            return;
                        } catch (leaderboardError) {
                            console.error("Failed to create leaderboard entry in fallback:", leaderboardError.message);
                        }
                    }
                }
            } catch (fallbackError) {
                console.error("Fallback matching also failed:", fallbackError.message);
            }
            
            // If both primary and fallback approaches fail
            res.status(201).json({
                resume: savedResume,
                message: "Resume uploaded successfully. Matching API unavailable and fallback matching failed."
            });
        }
    } catch (error) {
        console.error("Error processing resume:", error.message);
        
        if (error.response) {
            console.error("API Error Status:", error.response.status);
            console.error("API Error Data:", error.response.data);
        }
        
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

exports.uploadJobDescription = async (req, res) => {
    try {
        console.log("Received Body:", req.body);

        const { job_description, skills_weight, education_weight, experience_weight, projects_weight } = req.body;

        if (!job_description) {
            return res.status(400).json({ error: "Job description is required" });
        }

        console.log("Sending to FastAPI with job description length:", job_description.length);

        const response = await axios.post(
            "https://3d37f9c1-2295-4b9e-8f45-a2a118e7be19-00-27r26q9d5zekl.pike.replit.dev/parse/job-description",
            new URLSearchParams({ job_description }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        console.log("FastAPI Raw Response:", JSON.stringify(response.data, null, 2));

        if (!response.data) {
            console.error("Empty response data from FastAPI");
            return res.status(500).json({ error: "Empty response from parsing service" });
        }

        const title = response.data.title || response.data.Title || "Unknown Title";
        const company = response.data.company || response.data.Company || "Unknown Company";

        const requiredSkills = Array.isArray(response.data.required_skills) 
            ? response.data.required_skills 
            : (Array.isArray(response.data.requiredSkills) 
                ? response.data.requiredSkills 
                : []);

        const preferredSkills = Array.isArray(response.data.preferred_skills) 
            ? response.data.preferred_skills 
            : (Array.isArray(response.data.preferredSkills) 
                ? response.data.preferredSkills 
                : []);

        let experienceReqs = response.data.experience_requirements || response.data.experienceRequirements || "Not specified";
        let educationReqs = response.data.education_requirements || response.data.educationRequirements || "Not specified";

        const responsibilities = Array.isArray(response.data.responsibilities) 
            ? response.data.responsibilities 
            : (Array.isArray(response.data.Responsibilities) 
                ? response.data.Responsibilities 
                : []);

        console.log("Extracted fields for database:", {
            title,
            company,
            requiredSkills: requiredSkills.length > 0 ? "Found" : "Empty array",
            preferredSkills: preferredSkills.length > 0 ? "Found" : "Empty array",
            experienceReqs: experienceReqs !== "Not specified" ? "Found" : "Not found",
            educationReqs: educationReqs !== "Not specified" ? "Found" : "Not found",
            responsibilities: responsibilities.length > 0 ? "Found" : "Empty array"
        });

        // Save parsed job description data to DB with **dynamic weightage values**
        const savedJob = await prisma.jobDescription.create({
            data: {
                title,
                company,
                requiredSkills,
                preferredSkills,
                experienceRequirements: JSON.stringify(experienceReqs),
                educationRequirements: JSON.stringify(educationReqs),
                responsibilities,
                skills_weight: skills_weight ?? 0.35,  // Default values if not provided
                education_weight: education_weight ?? 0.30,
                experience_weight: experience_weight ?? 0.25,
                projects_weight: projects_weight ?? 0.10
            },
        });

        console.log("Successfully saved to database with ID:", savedJob.id);
        
        res.status(201).json(savedJob);
    } catch (error) {
        console.error("Error processing job description:", error.message);

        if (error.response) {
            console.error("API Error Status:", error.response.status);
            console.error("API Error Headers:", error.response.headers);
            console.error("API Error Data:", error.response.data);
        } else if (error.request) {
            console.error("No response received:", error.request);
        } else {
            console.error("Error during request setup:", error.message);
        }

        res.status(500).json({ 
            error: "Internal server error", 
            details: error.message,
            step: error.response ? "API response processing" : "Request execution"
        });
    }
};