const bot = require("./botInstance");
const notebookAPI = require("./services/api");

const menuButtons = [
  ["Огляд студентів", "Редагувати студента"],
  ["Додати студента", "Вилучити студента", "Головне меню"],
];

const menuOptions = {
  reply_markup: {
    keyboard: menuButtons,
    one_time_keyboard: true,
    resize_keyboard: true,
  },
};

const defaultSettings = {
  nextAction: false,
};

const showTutors = (chatId, btnList) => {
  const tutorOptions = {
    reply_markup: {
      keyboard: btnList,
      one_time_keyboard: true,
      resize_keyboard: true,
    },
  };
  bot.sendMessage(chatId, "Оберіть репетитора", tutorOptions);
};

const displayMainMenu = (chatId, settings = {}) => {
  const { nextAction } = { ...defaultSettings, ...settings };

  bot.sendMessage(
    chatId,
    nextAction
      ? "Оберіть наступну дію"
      : "Оберіть один з розділів з яким ви б хотіли попрацювати",
    menuOptions
  );
};

const showErrorAuth = (chatId) => {
  bot.sendMessage(chatId, "Вибачте, ви не маєте доступу до цього бота");
};

const defineMentor = (currentTutorUsername) => {
  switch (currentTutorUsername) {
    case "@S_o_n_y_a0":
      return "sofia";
    case "@higherooo":
      return "emir";
    case "@khilyao":
      return "sanya";
    case "@vi_torit":
      return "vika";
    case "@verdaverra":
      return "ravil";
    default:
      return null;
  }
};

const showAddStudentForm = async (chatId, message, userState) => {
  try {
    const messageText = message.text;
    const currentTutorUsername = "@" + message.from.username;

    const { step, studentData } = userState[chatId];

    if (step === 1) {
      bot.sendMessage(chatId, "Введіть імʼя студента:");

      userState[chatId].step = 2;
    } else if (step === 2) {
      userState[chatId].studentData.name = messageText;

      bot.sendMessage(chatId, "Введіть кількість занять на тиждень:");

      userState[chatId].step = 3;
    } else if (step === 3) {
      userState[chatId].studentData.lessonsPerWeek = Number(messageText);

      bot.sendMessage(chatId, "Введіть ціну за годину заняття:");

      userState[chatId].step = 4;
    } else if (step === 4) {
      userState[chatId].studentData.price = Number(messageText);
      userState[chatId].studentData.paidHours = 0;
      userState[chatId].studentData.mentor = defineMentor(currentTutorUsername);
      console.log(userState[chatId].studentData);
      await notebookAPI.addClient(userState[chatId].studentData);
      bot.sendMessage(chatId, `Студент ${studentData.name} успішно доданий!`);
      userState[chatId] = { addingStudent: false, step: 0, studentData: {} };
      displayMainMenu(chatId, { nextAction: true });
    }
  } catch (error) {
    console.error("Error adding student:", error);
    bot.sendMessage(chatId, "Сталася помилка при додаванні студента");
    userState[chatId] = { addingStudent: false, step: 0, studentData: {} };
  }
};

module.exports = {
  showTutors,
  displayMainMenu,
  showErrorAuth,
  showAddStudentForm,
};
