require("dotenv").config();
const express = require("express");
const { fetchAndStoreJobs } = require("./job"); // <-- We'll put job logic in jobs.js
//const cron = require("node-cron");

const MODE = process.env.MODE || "webhook"; // "webhook" or "cron"
const TIMEZONE = "Europe/London";

// ----- WEBHOOK MODE -----
if (MODE === "webhook") {
  const app = express();
  app.use(express.json());

  const TOKEN = process.env.TELEGRAM_TOKEN;
  if (!TOKEN) {
    console.error("❌ TELEGRAM_TOKEN missing.");
    process.exit(1);
  }
  const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

  // Health check
  app.get("/", (_req, res) => res.send("OK"));

  // Webhook handler
  app.post(`/webhook/${TOKEN}`, async (req, res) => {
    const message = req.body?.message;
    if (!message?.text) return res.sendStatus(200);

    const chatId = message.chat.id;
    const text = message.text.trim().toLowerCase();

    try {
      if (text.includes("job")) {
        const jobMsg = await fetchAndStoreJobs(true); // send always
        await require("axios").post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: jobMsg,
          parse_mode: "Markdown",
        });
      } else {
        await require("axios").post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "👋 Hi! Type *job* to get the latest job listings.",
          parse_mode: "Markdown",
        });
      }
    } catch (err) {
      console.error("❌ Webhook error:", err.message);
    }

    res.sendStatus(200);
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`📡 Webhook server running on port ${PORT}`);
  });
}

// ----- CRON MODE -----
if (MODE === "cron") {
  console.log("⏳ Starting in CRON mode — no web server will be started.");

  // Run every 20s for 20 minutes at 11:02 AM
  cron.schedule("2 11 * * *", () => {
    console.log("🕚 AM Burst Start");
    burst(20 * 1000, 20);
  }, { timezone: TIMEZONE });

  // Run every 20s for 20 minutes at 11:02 PM
  cron.schedule("2 23 * * *", () => {
    console.log("🌙 PM Burst Start");
    burst(20 * 1000, 20);
  }, { timezone: TIMEZONE });

  // Optional initial run
  fetchAndStoreJobs();
}

// ----- Helper to run burst jobs -----
function burst(intervalMs, minutes) {
  let count = 0;
  const total = Math.floor((minutes * 60 * 1000) / intervalMs);
  const id = setInterval(async () => {
    await fetchAndStoreJobs();
    count++;
    if (count >= total) clearInterval(id);
  }, intervalMs);
}
