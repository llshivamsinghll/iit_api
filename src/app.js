const express = require("express");
const cors = require("cors");
const getRoutes = require("./routes/getRoutes");
const { uploadResume, uploadJobDescription } = require("./controllers/uploadController");
const multer = require("multer");

// const errorHandler = require("./middleware/errorHandler");
require("dotenv").config();

const app = express();


app.use(cors({
  origin: ['http://localhost:5173', 'https://yourappdomain.com'], // Add your production domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.post("/upload/resume", upload.single("resume_file"), uploadResume);

app.post("/upload/job-description", uploadJobDescription);

// app.use(errorHandler);
app.use("/api", getRoutes);
module.exports = app;
