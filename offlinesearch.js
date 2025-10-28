require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cron = require("node-cron");

const app = express();
app.use(bodyParser.json());

const API_URL = "https://qy64m4juabaffl7tjakii4gdoa.appsync-api.eu-west-1.amazonaws.com/graphql";
const AUTH_TOKEN = `Bearer ${process.env.AUTH_TOKEN}`;
const LAST_MSG_FILE = path.join(__dirname, "lastMessage.json");

const GRAPHQL_QUERY = {
  operationName: "searchJobCardsByLocation",
  query: `query searchJobCardsByLocation($searchJobRequest: SearchJobRequest!) {
    searchJobCardsByLocation(searchJobRequest: $searchJobRequest) {
      jobCards {
        jobId
        jobTitle
        jobType
        employmentType
        city
        state
        totalPayRateMin
        totalPayRateMax
      }
    }
  }`,
  variables: {
    searchJobRequest: {
      locale: "en-GB",
      country: "United Kingdom",
      keyWords: "",
      equalFilters: [],
      rangeFilters: [],
    },
  },
};

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

const getJobMessage = async () =>  {
  try {
    const response = await axios.post(API_URL, GRAPHQL_QUERY, {
      headers: {
        "Content-Type": "application/json",
        Authorization: AUTH_TOKEN,
      },
    });

    const jobs = response.data?.data?.searchJobCardsByLocation?.jobCards || [];

    const partTimeJobs = jobs.filter(job => job.jobType?.toLowerCase() === "part-time");
    const fullTimeJobs = jobs.filter(job => job.jobType?.toLowerCase() === "full-time");
    const otherJobs = jobs.filter(job => {
      const type = job.jobType?.toLowerCase();
      return type !== "part-time" && type !== "full-time";
    });

    if (partTimeJobs.length > 0) {
      return `✅ Part-time jobs found:\n` + partTimeJobs.map(job =>
        `• ${job.jobTitle} (${job.city})`
      ).join("\n");
    } else if (fullTimeJobs.length > 0) {
      return `❗ Only full-time jobs available:\n` + fullTimeJobs.map(job =>
        `• ${job.jobTitle} (${job.city})`
      ).join("\n");
    } else if (otherJobs.length > 0) {
      const jobTypes = [...new Set(otherJobs.map(job => job.jobType))];
      return `📌 Other job(s) available [${jobTypes.join(", ")}]:\n` + otherJobs.map(job =>
        `• ${job.jobTitle} (${job.city})`
      ).join("\n");
    } else {
      return "❌ No jobs found.";
    }

  } catch (err) {
    return "❌ Error fetching job data: " + err.message;
  }
};

// Load last message if it exists
let lastMessageSent = "";
if (fs.existsSync(LAST_MSG_FILE)) {
  try {
    const data = fs.readFileSync(LAST_MSG_FILE, "utf-8");
    lastMessageSent = JSON.parse(data)?.message || "";
  } catch (err) {
    console.error("Failed to read lastMessage.json:", err.message);
  }
}

const fetchAndStoreJobs = async () => {
  try {
    const jobMsg = await getJobMessage();

    if (jobMsg !== lastMessageSent) {
      log("🔁 Job fetching...");
      lastMessageSent = jobMsg;
      fs.writeFileSync(LAST_MSG_FILE, JSON.stringify({ message: jobMsg }, null, 2));
    } else {
      log("⏸ No new job update to send.");
    }
  } catch (err) {
    const msg = "❌ Error running scheduled job check: " + err.message;
    log(msg);
  }
};

// ✅ 1-minute interval for 20 minutes
const start20MinuteJobInterval = () => {
  const msg = "⏳ Started 1-minute interval fetch for 20 minutes...";
  log(msg);
  
  let count = 0;
  const intervalId = setInterval(async () => {
    await fetchAndStoreJobs();
    count++;
    if (count >= 2400) {
      clearInterval(intervalId);
      const msg = "💤 System Standby... 🖥️ Scheduled Job Check completed.";
      log(msg);
    }
  }, 1000); // every 1 minute
};

// Optional: run once at server start
fetchAndStoreJobs();
start20MinuteJobInterval();

module.exports = { getJobMessage };