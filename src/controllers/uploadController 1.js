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
        console.log("Received Body:", req.body); // ✅ Debugging

        const { job_description } = req.body;
        if (!job_description) {
            return res.status(400).json({ error: "Job description is required" });
        }

        // Send request to FastAPI
        const response = await axios.post(
            "https://3d37f9c1-2295-4b9e-8f45-a2a118e7be19-00-27r26q9d5zekl.pike.replit.dev/parse/job-description",
            new URLSearchParams({ job_description }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        // Save parsed job description data to DB ✅
        const savedJob = await prisma.jobDescription.create({
            data: {
                title: response.data.title || "Unknown Title",
                company: response.data.company || "Unknown Company",
                requiredSkills: response.data.requiredSkills ?? [],  // ✅ Already correct
                preferredSkills: response.data.preferredSkills ?? [], // 🔥 Ensure this gets stored
                experienceRequirements: response.data.experienceRequirements
                    ? JSON.stringify(response.data.experienceRequirements)  
                    : "Not specified",
                educationRequirements: response.data.educationRequirements
                    ? JSON.stringify(response.data.educationRequirements)
                    : "Not specified",
                responsibilities: response.data.responsibilities ?? [],
            },
        });
        
        

        res.status(201).json(savedJob);
    } catch (error) {
        console.error("Error processing job description:", error.message);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
