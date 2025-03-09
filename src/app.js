const express = require("express");
const cors = require("cors");
const getRoutes = require("./routes/getRoutes");
const { uploadResume, uploadJobDescription } = require("./controllers/uploadController");
const multer = require("multer");

// const errorHandler = require("./middleware/errorHandler");
require("dotenv").config();

const app = express();

const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173' // Your frontend URL
}));
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.post("/upload/resume", upload.single("resume_file"), uploadResume);

app.post("/upload/job-description", uploadJobDescription);

// app.use(errorHandler);
app.use("/api", getRoutes);
module.exports = app;
