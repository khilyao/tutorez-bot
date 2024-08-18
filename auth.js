require("dotenv").config();

const allowedUsernames = process.env.ALLOWED_USERNAMES.split(",");

const isUserAllowed = (username) => {
  return allowedUsernames.includes(username);
};

module.exports = {
  isUserAllowed,
};
