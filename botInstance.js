require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.TG_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

module.exports = bot;
