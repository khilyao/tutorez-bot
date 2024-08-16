require("dotenv").config();
const notebookAPI = require("./services/notebookAPI");
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 4040;
const token = process.env.TG_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const userState = {};

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (userState[chatId] && userState[chatId].waitingForTutor) {
    handleTutorSelection(chatId, messageText);
    return;
  }

  if (messageText === "/list") {
    bot.sendMessage(
      chatId,
      "Оберіть репетитора:\nSanya\nRavil\nSofia\nEmir\nVika"
    );

    userState[chatId] = { waitingForTutor: true };
  }

  if (messageText === "/add") {
    bot.sendMessage(chatId, "Окей, понял");
  }
});

async function handleTutorSelection(chatId, messageText) {
  const validTutors = ["sanya", "ravil", "sofia", "emir", "vika"];

  if (validTutors.includes(messageText)) {
    const { data } = await notebookAPI.fetchClients();
    const mentorToFind = messageText.toLowerCase();

    const studentsInfo = data
      .filter(({ mentor }) => mentor === mentorToFind)
      .map(({ name, lessonsPerWeek, price, paidHours, lessonsPayment }) => {
        const lastLesson = lessonsPayment
          .reverse()
          .find(({ type }) => type === "lesson")?.date;
        const lastLessonDate = lastLesson || "No last lesson";

        return `\n${name}\nLessons per week: ${lessonsPerWeek}\nPrice: ${price}\nBalance (hours): ${paidHours}\nLast lesson: ${lastLessonDate}\n`;
      })
      .join("");

    bot.sendMessage(
      chatId,
      `Інформація щодо учнів ${messageText}: ${studentsInfo}`
    );
    userState[chatId].waitingForTutor = false;
  } else {
    bot.sendMessage(
      chatId,
      "Будь ласка, оберіть одного з запропонованих репетиторів"
    );
  }
}

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
