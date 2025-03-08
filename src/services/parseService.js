const axios = require("axios");

const BASE_URL = "https://3d37f9c1-2295-4b9e-8f45-a2a118e7be19-00-27r26q9d5zekl.pike.replit.dev";

const parseResume = async (resumeText) => {
    const response = await axios.post(`${BASE_URL}/parse/resume`, { resumeText });
    return response.data;
};

const parseJobDescription = async (jobText) => {
    const response = await axios.post(`${BASE_URL}/parse/job-description`, { jobText });
    return response.data;
};

module.exports = { parseResume, parseJobDescription };
