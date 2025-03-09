const prisma = require("../config/db"); // ✅ Import Prisma client
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
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

        // ✅ Transform API response to match Prisma schema
        const parsedData = response.data;
        const resumeData = {
            name: parsedData.name || "Unknown",
            email: parsedData.email || "",
            phone: parsedData.phone || "",
            technicalSkills: parsedData.technical_skills || [], // Convert to camelCase
            softSkills: parsedData.soft_skills || [],
            experience: parsedData.experience ? parsedData.experience.job_roles.map(role => 
                `${role.title} at ${role.company} (${role.duration})`
            ) : [],
            education: parsedData.education ? parsedData.education.degrees : [],
            projects: parsedData.projects ? parsedData.projects.map(proj => 
                `${proj.name} - ${proj.description}`
            ) : []
        };

        // Save transformed resume data to DB ✅
        const savedResume = await prisma.resume.create({
            data: resumeData,
        });

        res.status(201).json(savedResume);
    } catch (error) {
        console.error("Error processing resume:", error.message);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.uploadJobDescription = async (req, res) => {
    try {
        console.log("Received Body:", req.body); // Log incoming request
        
        const { job_description } = req.body;
        
        if (!job_description) {
            return res.status(400).json({ error: "Job description is required" });
        }
        
        console.log("Sending to FastAPI with job description length:", job_description.length);
        
        // Send request to FastAPI for processing
        const response = await axios.post(
            "https://3d37f9c1-2295-4b9e-8f45-a2a118e7be19-00-27r26q9d5zekl.pike.replit.dev/parse/job-description",
            new URLSearchParams({ job_description }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        
        // Log the entire response for debugging
        console.log("FastAPI Raw Response:", JSON.stringify(response.data, null, 2));
        
        // Check if we have the expected structure
        if (!response.data) {
            console.error("Empty response data from FastAPI");
            return res.status(500).json({ error: "Empty response from parsing service" });
        }
        
        // Extract all possible field names for debugging
        console.log("Available fields in response:", Object.keys(response.data));
        
        // Try both snake_case and camelCase variations for each field
        const title = response.data.title || response.data.Title || "Unknown Title";
        const company = response.data.company || response.data.Company || "Unknown Company";
        
        // For arrays, ensure we have an array even if the field is missing or null
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
        
        // For objects that need to be stringified
        let experienceReqs = "Not specified";
        if (response.data.experience_requirements) {
            experienceReqs = JSON.stringify(response.data.experience_requirements);
        } else if (response.data.experienceRequirements) {
            experienceReqs = JSON.stringify(response.data.experienceRequirements);
        }
        
        let educationReqs = "Not specified";
        if (response.data.education_requirements) {
            educationReqs = JSON.stringify(response.data.education_requirements);
        } else if (response.data.educationRequirements) {
            educationReqs = JSON.stringify(response.data.educationRequirements);
        }
        
        // Get responsibilities, checking multiple possible field names
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
        
        // Save parsed job description data to DB
        const savedJob = await prisma.jobDescription.create({
            data: {
                title,
                company,
                requiredSkills,
                preferredSkills,
                experienceRequirements: experienceReqs,
                educationRequirements: educationReqs,
                responsibilities,
            },
        });
        
        console.log("Successfully saved to database with ID:", savedJob.id);
        
        res.status(201).json(savedJob);
    } catch (error) {
        console.error("Error processing job description:", error.message);
        
        // Log more detailed error information
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