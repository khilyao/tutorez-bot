const https = require("https");
require("dotenv").config();
const notebookAPI = require("./services/api");
const { chunkArray } = require("./utils");
const {
  showTutors,
  displayMainMenu,
  showErrorAuth,
  showAddStudentForm,
  removeClient,
  handleEditStudentInfo,
  notifyAboutLosingStudent,
  updatePossibleStudentInfo,
} = require("./navigation");
const { isUserAllowed } = require("./auth");
const bot = require("./botInstance");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 4040;

const userState = {};

setInterval(() => {
  https.get("https://tutorez-bot.onrender.com");
}, 45000);

const chooseTutor = async (chatId) => {
  const validTutors = await notebookAPI.fetchTutors().then((tutors) => {
    return tutors.map(({ tutor }) => {
      return tutor.charAt(0).toUpperCase() + tutor.slice(1).toLowerCase();
    });
  });

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

        return `\n<b>${name}</b>\n<b>Lessons per week</b>: ${lessonsPerWeek}\n<b>Price</b>: ${price}\n<b>Balance (paid hours)</b>: ${paidHours}\n<b>Last lesson</b>: ${lastLessonDate}\n`;
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

  console.log(`Log: action from ${username} in ${chatId}`);

  if (!isUserAllowed(username)) {
    showErrorAuth(chatId);
    return;
  }

  if (messageText === "Головне меню") {
    userState[chatId] = {};
    displayMainMenu(chatId);
    return;
  }

  if (userState[chatId] && userState[chatId].addingStudent) {
    showAddStudentForm(chatId, msg, userState);
    return;
  }

  if (userState[chatId] && userState[chatId].waitingForTutor) {
    if (messageText === "Огляд студентів" || messageText === "Головне меню") {
      userState[chatId] = {};
      displayMainMenu(chatId);
      return;
    }

    handleTutorSelection(chatId, msg);
    return;
  }

  if (userState[chatId] && userState[chatId].deletingStudent) {
    removeClient(chatId, msg, userState);
    return;
  }

  if (userState[chatId] && userState[chatId].manipulatingStudent) {
    updatePossibleStudentInfo(chatId, msg, userState);
    return;
  }

  if (userState[chatId] && userState[chatId].losingStudent) {
    notifyAboutLosingStudent(chatId, msg, userState);
    return;
  }

  if (userState[chatId] && userState[chatId].changingStudentInfo) {
    handleEditStudentInfo(chatId, msg, userState);
    return;
  }

  const showTempError = (chatId) => {
    bot.sendMessage(
      chatId,
      "<b>Бот оновлюється!⚒️</b>\nСкористайтеся сайтом для внесення інформації!\nВи все ще можете <b>повідомити про втрату студента.</b>",
      { parse_mode: "HTML" }
    );
    displayMainMenu(chatId);
  };

  switch (messageText) {
    case "/start":
      displayMainMenu(chatId);

      break;

    case "Огляд студентів":
      showTempError(chatId);
      return;

      chooseTutor(chatId);
      userState[chatId] = { waitingForTutor: true };
      break;

    case "Головне меню":
      userState[chatId] = {};
      displayMainMenu(chatId);
      break;

    case "Додати студента":
      showTempError(chatId);
      return;
      userState[chatId] = { addingStudent: true, step: 1, studentData: {} };
      showAddStudentForm(chatId, msg, userState);
      break;

    case "Вилучити студента":
      showTempError(chatId);
      return;
      userState[chatId] = { deletingStudent: true, step: 1 };
      removeClient(chatId, msg, userState);
      break;

    case "Нові студенти":
      showTempError(chatId);
      return;
      userState[chatId] = { manipulatingStudent: true, step: 1 };
      updatePossibleStudentInfo(chatId, msg, userState);
      break;

    case "Повідомити про втрату студента":
      userState[chatId] = { losingStudent: true, step: 1 };
      notifyAboutLosingStudent(chatId, msg, userState);
      break;

    case "Редагувати студента":
      showTempError(chatId);
      return;
      userState[chatId] = {
        changingStudentInfo: true,
        step: 1,
        studentData: {},
      };
      handleEditStudentInfo(chatId, msg, userState);
      break;

    default:
      displayMainMenu(chatId);
  }
});

bot.on("polling_error", (err) => console.error(err));

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
