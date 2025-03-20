const prisma = require("../config/db"); // Import Prisma client

// Fetch all job descriptions
exports.getJobDescriptions = async (req, res) => {
    try {
        const jobDescriptions = await prisma.jobDescription.findMany();
        res.status(200).json(jobDescriptions);
    } catch (error) {
        console.error("Error fetching job descriptions:", error.message);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

// Fetch a specific job description by ID
exports.getJobDescriptionById = async (req, res) => {
    try {
        const { id } = req.params;
        const jobDescription = await prisma.jobDescription.findUnique({
            where: { id: id },
        });

        if (!jobDescription) {
            return res.status(404).json({ error: "Job description not found" });
        }

        res.status(200).json(jobDescription);
    } catch (error) {
        console.error("Error fetching job description:", error.message);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

// Fetch all resumes
exports.getResumes = async (req, res) => {
    try {
        const resumes = await prisma.resume.findMany();
        res.status(200).json(resumes);
    } catch (error) {
        console.error("Error fetching resumes:", error.message);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

// Fetch a specific resume by ID
exports.getResumeById = async (req, res) => {
    try {
        const { id } = req.params;
        const resume = await prisma.resume.findUnique({
            where: { id: id },
        });

        if (!resume) {
            return res.status(404).json({ error: "Resume not found" });
        }

        res.status(200).json(resume);
    } catch (error) {
        console.error("Error fetching resume:", error.message);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

// Register routes in Express

