const axios = require("axios");

axios.defaults.baseURL = `https://${process.env.API_KEY}.mockapi.io`;

const fetchClients = async () => {
  return axios.get("/clients").then(({ data }) => data);
};

const fetchTutors = async () => {
  return axios.get("/tutors").then(({ data }) => data);
};

const addClient = async () => {
  return axios.post("/clients");
};

const notebookAPI = { fetchClients, fetchTutors, addClient };
module.exports = notebookAPI;
