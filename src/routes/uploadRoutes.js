const express = require("express");
const multer = require("multer");
const { uploadResume, uploadJobDescription } = require("../controllers/uploadController");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Resume Upload Route
router.post("/upload/resume", upload.single("resume_file"), uploadResume);

// Job Description Upload Route
router.post("/upload/job-description", uploadJobDescription);

module.exports = router;
