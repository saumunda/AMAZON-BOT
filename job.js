const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const MODE = process.env.MODE || "webhook"; // "webhook" or "cron"
const TIMEZONE = "Europe/London";

const API_URL = "https://qy64m4juabaffl7tjakii4gdoa.appsync-api.eu-west-1.amazonaws.com/graphql";
const AUTH_TOKEN = process.env.AUTH_TOKEN ? `Bearer ${process.env.AUTH_TOKEN}` : "";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_IDS = [process.env.TELEGRAM_USER_ID].filter(Boolean);
const LAST_MSG_FILE = path.join(__dirname, "lastMessage.json");

const tg = axios.create({
  baseURL: `https://api.telegram.org/bot${TELEGRAM_TOKEN}`,
  timeout: 15000,
});

let lastMessageSent = "";
if (fs.existsSync(LAST_MSG_FILE)) {
  try {
    lastMessageSent = JSON.parse(fs.readFileSync(LAST_MSG_FILE, "utf-8"))?.message || "";
  } catch {}
}

const sendToTelegramUsers = async (message) => {
  for (const id of TELEGRAM_IDS) {
    try {
      await tg.post("/sendMessage", {
        chat_id: id,
        text: message,
        parse_mode: "Markdown",
      });
    } catch (err) {
      console.error(`❌ Send fail to ${id}:`, err.message);
    }
  }
};

const getJobMessage = async () => {
  try {
    const { data } = await axios.post(API_URL, {
      operationName: "searchJobCardsByLocation",
      query: `query searchJobCardsByLocation($searchJobRequest: SearchJobRequest!) {
        searchJobCardsByLocation(searchJobRequest: $searchJobRequest) {
          jobCards {
            jobTitle
            jobType
            city
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
    }, {
      headers: {
        "Content-Type": "application/json",
        Authorization: AUTH_TOKEN,
      },
    });

    const jobs = data?.data?.searchJobCardsByLocation?.jobCards || [];
    if (!jobs.length) return "❌ No jobs found.";

    return jobs.map(j => `• ${j.jobTitle} (${j.city})`).join("\n");

  } catch (err) {
    return "❌ Error fetching jobs: " + err.message;
  }
};

cron.schedule("*/1 * * * *", () => {
  console.log("🧪 Test cron firing every minute");
  fetchAndStoreJobs();
}, { timezone: TIMEZONE });


const fetchAndStoreJobs = async (forceSend = false) => {
  const jobMsg = await getJobMessage();
  if (forceSend || jobMsg !== lastMessageSent) {
    await sendToTelegramUsers(jobMsg);
    lastMessageSent = jobMsg;
    fs.writeFileSync(LAST_MSG_FILE, JSON.stringify({ message: jobMsg }, null, 2));
  }
};

fetchAndStoreJobs(true);

module.exports = { fetchAndStoreJobs, getJobMessage };
