const bot = require("./botInstance");
const notebookAPI = require("./services/api");
const { v4: uuidv4 } = require("uuid");
const { chunkArray, getCurrentDate } = require("./utils");

const menuButtons = [
  ["Огляд студентів", "Редагувати студента", "Додати студента"],
  ["Вилучити студента", "Нові студенти"],
  ["Повідомити про втрату студента", "Головне меню"],
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
    case "@mnikkki":
      return "veronika";
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

const updatePossibleStudentInfo = async (chatId, msg, userState) => {
  const currentTutorName = "@" + msg.from.username;
  const allPossibleTutors = await notebookAPI.fetchTutors();

  const currentTutorInfo = await allPossibleTutors.find(
    ({ tutor }) => tutor === defineMentor(currentTutorName)
  );

  const possibleStudentsForCurrentTutor = currentTutorInfo?.possibleStudents;

  if (userState[chatId].step === 1) {
    const history = possibleStudentsForCurrentTutor
      ? possibleStudentsForCurrentTutor
          .map(
            ({ name, subject, price, contact, history }) =>
              `\n<b>Name</b>: ${name}\n<b>Subject</b>: ${subject}\n<b>Price</b>: ${price}\n<b>Contacts</b>:${contact}\n<b>History</b>: ${history
                .map(
                  ({ date, message }) =>
                    `\n<b>Дата створення запису</b>: ${date}\n<b>Повідомлення</b>: ${message}\n`
                )
                .join("")}`
          )
          .join("\n-----------------------------------------\n")
      : "Очікуємо нових студентів...";

    const students = possibleStudentsForCurrentTutor.map(({ name }) => name);

    const clientsOptions = {
      reply_markup: {
        keyboard: [students, ["Головне меню"]],
        ...defaultBtnActions,
      },
      parse_mode: "HTML",
    };

    bot.sendMessage(chatId, history, clientsOptions);

    bot.sendMessage(
      chatId,
      "Оберіть учня для зміни поточної інформації",
      clientsOptions
    );

    userState[chatId].step = 2;
  } else if (userState[chatId].step === 2) {
    userState[chatId].idStudentToManipulate =
      possibleStudentsForCurrentTutor.find(({ name }) => name === msg.text)?.id;

    const actionsOptions = {
      reply_markup: {
        keyboard: [
          ["Внести запис до історії студента"],
          [
            "Видалити з потенційних учнів (після цього потрібно власноруч внести до основних учнів)",
          ],
          ["Головне меню"],
        ],
        ...defaultBtnActions,
      },
      parse_mode: "HTML",
    };

    userState[chatId].step = 3;

    bot.sendMessage(
      chatId,
      "Оберіть наступну дію для цього учня",
      actionsOptions
    );
  } else if (userState[chatId].step === 3) {
    if (msg.text === "Внести запис до історії студента") {
      bot.sendMessage(
        chatId,
        "Розпишіть коротко відомість про студента\n<b>Приклади:</b>\n<i>05.09 позаймалися півгодини пробного уроку, мама дитини захотіла викладача-дівчину</i>\nАбо\n<i>Клієнту було задорого, домовитися за меншу ціну не вийшло, насправді у дитини рівень знань виявився вище, англ мова - B1</i>",
        { parse_mode: "HTML" }
      );

      userState[chatId].step = 4;
      userState[chatId].record = true;
    }

    if (
      msg.text ===
      "Видалити з потенційних учнів (після цього потрібно власноруч внести до основних учнів)"
    ) {
      const updatedPossibleStudents = currentTutorInfo.possibleStudents.filter(
        ({ id }) => id !== userState[chatId].idStudentToManipulate
      );

      currentTutorInfo.possibleStudents = updatedPossibleStudents;

      notebookAPI.updateTutorInfoByPossibleStudents(
        currentTutorInfo.tutorId,
        currentTutorInfo
      );

      bot.sendMessage(
        chatId,
        "Вітаю з новим студентом! Студент видалений з потенційних. Не забудь внести його до своїх студентів окремо"
      );
      userState[chatId] = {};
      displayMainMenu(chatId, { nextAction: false });
    }
  } else if (userState[chatId].step === 4) {
    const possibleStudent = currentTutorInfo.possibleStudents.find(
      ({ id }) => id === userState[chatId].idStudentToManipulate
    );

    possibleStudent.history.push({
      date: getCurrentDate(),
      message: msg.text,
    });

    notebookAPI.addRecordAboutStudentForTutor(
      currentTutorInfo.tutorId,
      currentTutorInfo
    );

    bot.sendMessage(
      chatId,
      "Запис про учня успішно створений! Невдовзі ви отримаєте фідбек"
    );

    userState[chatId] = {};
    displayMainMenu(chatId);
  }
};

const notifyAboutLosingStudent = async (chatId, msg, userState) => {
  const { step } = userState[chatId];

  if (step === 1) {
    bot.sendMessage(
      chatId,
      "Вкажіть імʼя довіреної особи (відповідальна за оплату)"
    );

    userState[chatId].step = 2;
  }

  if (step === 2) {
    userState[chatId].possibleStudent = {
      name: msg.text,
    };
    userState[chatId].step = 3;

    bot.sendMessage(
      chatId,
      "Вкажіть контакт особи (номер або нікнейм в телеграмі)"
    );
  }

  if (step === 3) {
    userState[chatId].step = 4;
    userState[chatId].possibleStudent.contact = msg.text;

    bot.sendMessage(chatId, "Вкажіть навчальний предмет(-и)");
  }

  if (step === 4) {
    userState[chatId].possibleStudent.subject = msg.text;
    userState[chatId].step = 5;

    bot.sendMessage(chatId, "Вкажіть ціну за годину за якою ви займалися");
  }

  if (step === 5) {
    userState[chatId].possibleStudent.price = msg.text;
    userState[chatId].step = 6;

    bot.sendMessage(
      chatId,
      "Напишіть будь-які уточнення по учню та коротенький опис причини чому перестали займатися"
    );
  }

  if (step === 6) {
    userState[chatId].possibleStudent.message = msg.text;

    const { name, price, message, subject, contact } =
      userState[chatId].possibleStudent;

    bot.sendMessage(
      chatId,
      "Дані про учня були збережені! Вже шукаємо нового учня для тебе"
    );

    bot.sendMessage(
      642894689,
      `<b>Втрата студента!</b>\n<b>Імʼя:</b> ${name}\n<b>Предмет:</b> ${subject}\n<b>Контакт:</b> ${contact}\n<b>Ціна за годину</b>: ${price}\n<b>Повідомлення:</b> ${message}\n<b>Від репетитора:</b> ${defineMentor(
        "@" + msg.from.username
      )}`,
      {
        parse_mode: "HTML",
      }
    );

    userState[chatId] = {};
    displayMainMenu(chatId);
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
              [
                { text: "0.5 год (30 хв)" },
                { text: "0.75 год (45 хв)" },
                { text: "1 год" },
              ],
              [
                { text: "1.5 год (1 год 30 хв)" },
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

      const { status } = await notebookAPI.addPaymentToClient(
        userState[chatId].idStudentToEdit,
        updatedStudent
      );

      if (status === 200) {
        bot.sendMessage(chatId, "Зміну про оплату було успішно внесено!");
      } else {
        bot.sendMessage(
          chatId,
          "Виникли помилки при внесенні платежу. Спробуйте ще раз!"
        );
      }

      userState[chatId] = {};
      displayMainMenu(chatId);
      return;
    }

    if (userState[chatId].addingLesson) {
      const lessonDuration = parseFloat(currentMsg);

      userState[chatId].newStudentLessonData = {
        id: uuidv4(),
        duration: lessonDuration,
        date: getCurrentDate(),
        paid: student.paidHours > lessonDuration ? true : false,
        type: "lesson",
      };
      userState[chatId].lessonDuration = lessonDuration;

      const homeworkBtns = {
        reply_markup: {
          keyboard: [["Так", "Ні", "Головне меню"]],
          ...defaultBtnActions,
        },
      };

      bot.sendMessage(
        chatId,
        "Чи виконав учень домашнє завдання?",
        homeworkBtns
      );
    }

    userState[chatId].step = 6;
  } else if (step === 6) {
    if (currentMsg === "Так") {
      userState[chatId].newStudentLessonData.homework = true;
    } else {
      userState[chatId].newStudentLessonData.homework = false;
    }

    reviewBtns = {
      reply_markup: {
        keyboard: [["1", "2", "3", "4", "5", "Головне меню"]],
        ...defaultBtnActions,
      },
    };

    bot.sendMessage(chatId, "Поставте оцінку учню за заняття", reviewBtns);

    userState[chatId].step = 7;
  } else if (step === 7) {
    const student = clients.find(
      ({ id }) => userState[chatId].idStudentToEdit === id
    );

    const review = parseInt(currentMsg);

    userState[chatId].newStudentLessonData.review = review;
    student.lessonsPayment.push(userState[chatId].newStudentLessonData);
    student.paidHours -= userState[chatId].lessonDuration;

    const { status } = await notebookAPI.addLessonToClient(
      userState[chatId].idStudentToEdit,
      student
    );

    if (status === 200) {
      bot.sendMessage(chatId, "Заняття успішно добавлено до історії");
    } else {
      bot.sendMessage(
        chatId,
        "Виникли помилки при створенні запису. Спробуйте ще раз!"
      );
    }

    userState[chatId] = {};
    displayMainMenu(chatId);
  }
};

module.exports = {
  showTutors,
  displayMainMenu,
  showErrorAuth,
  showAddStudentForm,
  handleEditStudentInfo,
  removeClient,
  updatePossibleStudentInfo,
  notifyAboutLosingStudent,
};
