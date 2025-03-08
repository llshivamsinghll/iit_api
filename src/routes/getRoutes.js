const express = require("express");
const router = express.Router();
const { getJobDescriptions, getJobDescriptionById, getResumes, getResumeById } = require("../controllers/getController");

router.get("/job-descriptions", getJobDescriptions);
router.get("/job-descriptions/:id",getJobDescriptionById);
router.get("/resumes", getResumes);
router.get("/resumes/:id", getResumeById);

module.exports = router;