require("dotenv").config();
const notebookAPI = require("./services/api");
const { showTutors, displayMainMenu, showErrorAuth } = require("./navigation");
const { isUserAllowed } = require("./auth");
const bot = require("./botInstance");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 4040;

const userState = {};

const chooseTutor = async (chatId) => {
  const validTutors = await notebookAPI.fetchTutors().then((tutors) => {
    return tutors.map(({ tutor }) => {
      return tutor.charAt(0).toUpperCase() + tutor.slice(1).toLowerCase();
    });
  });

  const chunkArray = (array, chunkSize) => {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    return result;
  };

  const tutorButtons = chunkArray(validTutors, 3).map((tutorsRow) => {
    return tutorsRow.map((tutor) => ({ text: tutor }));
  });
  tutorButtons[tutorButtons.length - 1].push("Головне меню");

  showTutors(chatId, tutorButtons);
};

const handleTutorSelection = async (chatId, message) => {
  const validTutors = await notebookAPI.fetchTutors().then((tutors) => {
    return tutors.map(({ tutor }) => tutor);
  });

  const messageText = message.text;
  const currentTutorUsername = "@" + message.from.username;
  const mentorToFind = messageText.toLowerCase();

  if (validTutors.includes(mentorToFind)) {
    const tutors = await notebookAPI.fetchTutors();

    const isChoseTutor =
      tutors.find(({ tutor }) => mentorToFind === tutor).tgUsername ===
      currentTutorUsername
        ? true
        : false;

    if (!isChoseTutor && currentTutorUsername !== process.env.MAIN_USERNAME) {
      bot.sendMessage(chatId, `Ви не можете переглянути дану інформацію`);
      displayMainMenu(chatId, {
        nextAction: true,
      });
      userState[chatId] = { waitingForTutor: false };
      return;
    }

    const clients = await notebookAPI.fetchClients();
    const studentsInfo = clients
      .filter(({ mentor }) => mentor === mentorToFind)
      .map(({ name, lessonsPerWeek, price, paidHours, lessonsPayment }) => {
        const lastLesson = lessonsPayment
          .reverse()
          .find(({ type }) => type === "lesson")?.date;
        const lastLessonDate = lastLesson || "No info";

        return `\n<b>${name}</b>\n<b>Lessons per week</b>: ${lessonsPerWeek}\n<b>Price</b>: ${price}\n<b>Balance (hours)</b>: ${paidHours}\n<b>Last lesson</b>: ${lastLessonDate}\n`;
      })
      .join("");

    bot.sendMessage(
      chatId,
      `Інформація щодо учнів ${messageText}: ${studentsInfo}`,
      { parse_mode: "HTML" }
    );
    userState[chatId].waitingForTutor = false;
    displayMainMenu(chatId, {
      nextAction: true,
    });
  } else if (messageText === "Головне меню") {
    displayMainMenu(chatId);
  } else {
    bot.sendMessage(
      chatId,
      "Будь ласка, оберіть одного з запропонованих репетиторів"
    );
  }
};

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  const username = msg.from.username ? `@${msg.from.username}` : null;

  if (!isUserAllowed(username)) {
    showErrorAuth(chatId);
    return;
  }

  if (userState[chatId] && userState[chatId].waitingForTutor) {
    handleTutorSelection(chatId, msg);
    return;
  }

  switch (messageText) {
    case "/start":
      displayMainMenu(chatId);
      break;

    case "Огляд студентів":
      chooseTutor(chatId);
      userState[chatId] = { waitingForTutor: true };
      break;

    case "Головне меню":
      displayMainMenu(chatId);
      break;

    default:
      displayMainMenu(chatId);
  }
});

bot.on("polling_error", (err) => console.error(err));

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
