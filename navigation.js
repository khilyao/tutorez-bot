const bot = require("./botInstance");

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

module.exports = {
  showTutors,
  displayMainMenu,
  showErrorAuth,
};
