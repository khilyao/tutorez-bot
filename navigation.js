const bot = require("./botInstance");
const notebookAPI = require("./services/api");
const { v4: uuidv4 } = require("uuid");
const { chunkArray, getCurrentDate } = require("./utils");

const menuButtons = [
  ["Огляд студентів", "Редагувати студента"],
  ["Додати студента", "Вилучити студента", "Головне меню"],
];

const defaultBtnActions = {
  one_time_keyboard: true,
  resize_keyboard: true,
};

const menuOptions = {
  reply_markup: {
    keyboard: menuButtons,
    ...defaultBtnActions,
  },
};

const defaultSettings = {
  nextAction: false,
};

const distributePayment = (client, amount) => {
  let credit = 0;
  let remainingAmount = amount;

  for (let lesson of client.lessonsPayment) {
    if (lesson.type === "lesson" && !lesson.paid) {
      const payment = Math.min(lesson.duration, remainingAmount);
      remainingAmount -= payment;
      credit += payment;
      lesson.paid = payment === lesson.duration;

      if (remainingAmount <= 0) break;
    }
  }

  return credit;
};

const showTutors = (chatId, btnList) => {
  const tutorOptions = {
    reply_markup: {
      keyboard: btnList,
      ...defaultBtnActions,
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

const removeClient = async (chatId, msg, userState) => {
  const { step } = userState[chatId];
  const currentTutorName = defineMentor("@" + msg.from.username);
  const clients = await notebookAPI.fetchClients();

  if (msg.text === "Головне меню") {
    userState[chatId] = {};
    displayMainMenu(chatId, { nextAction: true });
    return;
  }

  if (step === 1) {
    const filteredClients = clients.filter(
      ({ mentor }) => mentor === currentTutorName
    );
    const possibleClientsToRemove = chunkArray(filteredClients, 4).map(
      (tutorsRow) => {
        return tutorsRow.map(({ name }) => ({ text: name }));
      }
    );

    possibleClientsToRemove[possibleClientsToRemove.length - 1].push(
      "Головне меню"
    );

    const clientsOptions = {
      reply_markup: {
        keyboard: possibleClientsToRemove,
        ...defaultBtnActions,
      },
    };

    bot.sendMessage(
      chatId,
      "Оберіть необхідного студента для видалення",
      clientsOptions
    );

    userState[chatId].step = 2;
  } else if (step === 2) {
    const studentToDelete = msg.text;

    const idStudentToDelete = clients.find(
      ({ mentor, name }) =>
        studentToDelete === name && mentor === currentTutorName
    )?.id;

    await notebookAPI.removeClient(idStudentToDelete).then(({ status }) => {
      if (status === 200) {
        bot.sendMessage(chatId, "Студент успішно видалений!");
        return;
      }

      bot.sendMessage(chatId, "Сталася помилка, спробуйте пізніше");
    });

    userState[chatId] = {};

    displayMainMenu(chatId, { nextAction: true });
  }
};

const handleEditStudentInfo = async (chatId, msg, userState) => {
  const { step } = userState[chatId];
  const currentTutorName = defineMentor("@" + msg.from.username);
  const clients = await notebookAPI.fetchClients();
  const currentMsg = msg.text;

  if (msg.text === "Головне меню") {
    userState[chatId] = {};
    displayMainMenu(chatId, { nextAction: true });
    return;
  }

  if (step === 1) {
    const filteredClients = clients.filter(
      ({ mentor }) => mentor === currentTutorName
    );
    const possibleClientsToEdit = chunkArray(filteredClients, 4).map(
      (tutorsRow) => {
        return tutorsRow.map(({ name }) => ({ text: name }));
      }
    );
    possibleClientsToEdit[possibleClientsToEdit.length - 1].push(
      "Головне меню"
    );

    const clientsOptions = {
      reply_markup: {
        keyboard: possibleClientsToEdit,
        ...defaultBtnActions,
      },
    };

    bot.sendMessage(
      chatId,
      "Оберіть необхідного студента для редагування",
      clientsOptions
    );

    userState[chatId].step = 2;
  } else if (step === 2) {
    const idStudentToEdit = clients.find(
      ({ mentor, name }) => currentMsg === name && mentor === currentTutorName
    )?.id;
    userState[chatId].idStudentToEdit = idStudentToEdit;

    const clientActions = {
      reply_markup: {
        keyboard: [
          [{ text: "Змінити дані про студента" }],
          [{ text: "Змінити поточний баланс годин" }, { text: "Головне меню" }],
        ],

        ...defaultBtnActions,
      },
    };

    bot.sendMessage(
      chatId,
      "Оберіть яку зміну ви бажаєте внести",
      clientActions
    );

    userState[chatId].step = 3;
  } else if (step === 3) {
    if (currentMsg === "Змінити поточний баланс годин") {
      const clientActions = {
        reply_markup: {
          keyboard: [
            [
              { text: "Внесення платежу" },
              { text: "Внесення заняття" },
              { text: "Головне меню" },
            ],
          ],
          ...defaultBtnActions,
        },
      };

      userState[chatId].changingBalance = true;

      bot.sendMessage(chatId, "Оберіть дію для зміни балансу", clientActions);
    }

    if (currentMsg === "Змінити дані про студента") {
      bot.sendMessage(
        chatId,
        "⚒️Даний розділ в розробці, перенаправляю до основного меню..."
      );
      userState[chatId] = {};
      displayMainMenu(chatId);
      return;
    }

    userState[chatId].step = 4;
  } else if (step === 4) {
    if (userState[chatId].changingBalance) {
      if (currentMsg === "Внесення платежу") {
        const paymentBtns = {
          reply_markup: {
            keyboard: [
              [
                { text: "1" },
                { text: "2" },
                { text: "3" },
                { text: "4" },
                { text: "5" },
              ],
              [
                { text: "6" },
                { text: "7" },
                { text: "8" },
                { text: "9" },
                { text: "10" },
                { text: "Головне меню" },
              ],
            ],
            ...defaultBtnActions,
          },
        };

        userState[chatId].addingPayment = true;

        bot.sendMessage(
          chatId,
          "Внесіть кількість оплачених годин в платежі числом (1, 2, 4, 5.5) або оберіть зі списку",
          paymentBtns
        );
      }

      if (currentMsg === "Внесення заняття") {
        const durationBtns = {
          reply_markup: {
            keyboard: [
              [{ text: "30 хв" }, { text: "45 хв" }, { text: "1 год" }],
              [
                { text: "1 год 30 хв" },
                { text: "2 год" },
                { text: "Головне меню" },
              ],
            ],
            ...defaultBtnActions,
          },
        };

        userState[chatId].addingLesson = true;

        bot.sendMessage(
          chatId,
          "Оберіть тривалість заняття\nP.s Для інших годин варто скористатися сайтом для внесення даних",
          durationBtns
        );
      }
      userState[chatId].step = 5;
    }
  } else if (step === 5) {
    const student = clients.find(
      ({ id }) => userState[chatId].idStudentToEdit === id
    );

    if (userState[chatId].addingPayment) {
      const { paidHours, lessonsPayment } = student;
      const paymentPaid = +currentMsg;
      const newPaidHours = paidHours + paymentPaid;
      const credit = distributePayment(student, paymentPaid);

      if (newPaidHours >= 0) {
        lessonsPayment.forEach((lesson) => {
          if (lesson.type === "lesson") {
            lesson.paid = true;
          }
        });
      } else {
        let leftHours = paymentPaid;

        lessonsPayment.forEach((lesson) => {
          if (!lesson.paid) {
            if (leftHours > lesson.duration) {
              lesson.paid = true;
              leftHours -= lesson.duration;
            }
          }
        });
      }

      lessonsPayment.push({
        id: uuidv4(),
        date: getCurrentDate(),
        type: "payment",
        amount: paymentPaid,
        credit,
        balance: newPaidHours,
      });

      const updatedStudent = {
        ...student,
        paidHours: newPaidHours,
      };

      notebookAPI.addPaymentToClient(
        userState[chatId].idStudentToEdit,
        updatedStudent
      );
    }
  }
};

module.exports = {
  showTutors,
  displayMainMenu,
  showErrorAuth,
  showAddStudentForm,
  handleEditStudentInfo,
  removeClient,
};
