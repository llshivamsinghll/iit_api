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
            "https://41cd7f41-176f-482b-a0fb-55e00ff12626-00-v6o4c7kvy4fh.sisko.replit.dev/parse/resume",
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
            // Try using GET instead of POST for the matching API
            const matchResponse = await axios.get(
                `https://tender-seas-pick.loca.lt/api/matches`,
                {
                    params: {
                        resumeId: savedResume.id,
                        skills: resumeData.technicalSkills.join(','),
                        experience: resumeData.experience.join(','),
                        projects: resumeData.projects.join(','),
                        education: resumeData.education.join(',')
                    }
                }
            );
            
            if (matchResponse.data.success && matchResponse.data.matches) {
                // Find the best match (highest score)
                let bestMatch = null;
                let bestMatchJob = null;
                
                // Find the best matching job
                for (const match of matchResponse.data.matches) {
                    const jobDescription = await prisma.jobDescription.findFirst({
                        where: {
                            requiredSkills: {
                                hasSome: match.required_skills
                            }
                        }
                    });
                    
                    if (jobDescription && (!bestMatch || match.total_score > bestMatch.total_score)) {
                        bestMatch = match;
                        bestMatchJob = jobDescription;
                    }
                }
                
                if (bestMatch && bestMatchJob) {
                    // Create only one leaderboard entry for the best match
                    await prisma.leaderboard.create({
                        data: {
                            jobId: bestMatchJob.id,
                            resumeId: savedResume.id,
                            candidateName: resumeData.name,
                            candidateEmail: resumeData.email,
                            score: bestMatch.total_score
                        }
                    });
                    
                    // Return success with resume and match information
                    res.status(201).json({
                        resume: savedResume,
                        matches: 1,
                        message: `Resume uploaded and matched with the best job opportunity`
                    });
                } else {
                    // If no valid match found
                    res.status(201).json({
                        resume: savedResume,
                        message: "Resume uploaded successfully, but no valid job matches found"
                    });
                }
            } else {
                // If matching response is invalid, still return success for the resume upload
                res.status(201).json({
                    resume: savedResume,
                    message: "Resume uploaded successfully, but matching data was invalid"
                });
            }
        } catch (matchError) {
            console.error("Error with matching API:", matchError.message);
            
            // If matching API fails, still return success for the resume upload
            res.status(201).json({
                resume: savedResume,
                message: "Resume uploaded successfully. Matching API unavailable."
            });
        }
    } catch (error) {
        console.error("Error processing resume:", error.message);
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
            "https://41cd7f41-176f-482b-a0fb-55e00ff12626-00-v6o4c7kvy4fh.sisko.replit.dev/parse/job-description",
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
