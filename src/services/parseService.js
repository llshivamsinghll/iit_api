const axios = require("axios");

const BASE_URL = "http://localhost:8000";

const parseResume = async (resumeText) => {
    const response = await axios.post(`${BASE_URL}/parse/resume`, { resumeText });
    return response.data;
};

const parseJobDescription = async (jobText) => {
    const response = await axios.post(`${BASE_URL}/parse/job-description`, { jobText });
    return response.data;
};

module.exports = { parseResume, parseJobDescription };
