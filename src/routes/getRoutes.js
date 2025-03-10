const express = require("express");
const router = express.Router();
const { fetchLeaderboardData,getJobDescriptions, getJobDescriptionById, getResumes, getResumeById } = require("../controllers/getController");

router.get("/job-descriptions", getJobDescriptions);
router.get("/job-descriptions/:id",getJobDescriptionById);
router.get("/resumes", getResumes);
router.get("/resumes/:id", getResumeById);
router.get("/leaderboard", async (req, res) => {
    try {
        const jobId = req.query.jobId; // Get jobId from query params (optional)
        const data = await fetchLeaderboardData(jobId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch leaderboard data" });
    }
});

module.exports = router;