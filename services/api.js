const axios = require("axios");

axios.defaults.baseURL = `https://${process.env.API_KEY}.mockapi.io`;

const fetchClients = async () => {
  return axios.get("/clients");
};

const fetchTutors = async () => {
  return axios.get("/tutors");
};

const addClient = async () => {
  return axios.post("/clients").then();
};

const notebookAPI = { fetchClients, fetchTutors, addClient };
module.exports = notebookAPI;
