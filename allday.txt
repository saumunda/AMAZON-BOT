require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { getJobMessage } = require("./job"); // Import job-fetching logic

const app = express();
app.use(bodyParser.json());

const TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

// Webhook endpoint
app.post(`/webhook/${TOKEN}`, async (req, res) => {
  const message = req.body.message;
  if (!message || !message.text) return res.sendStatus(200);

  const chatId = message.chat.id;
  const text = message.text.trim();

  console.log(`[${new Date().toISOString()}] Message from ${chatId}: ${text}`);

  try {
    if (/job/i.test(text)) {
      const jobMsg = await getJobMessage();
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: jobMsg,
      });
    } else {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "👋 Hi! Type *job* to get the latest job listings.",
        parse_mode: "Markdown",
      });
    }
  } catch (err) {
    console.error("❌ Error processing message:", err.message);
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: "❌ Sorry, something went wrong while processing your request.",
    });
  }

  res.sendStatus(200);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Telegram Bot running on port ${PORT}`);
});