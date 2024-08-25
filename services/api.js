const axios = require("axios");

axios.defaults.baseURL = `https://${process.env.API_KEY}.mockapi.io`;

const fetchClients = async () => {
  try {
    return axios.get("/clients").then(({ data }) => data);
  } catch (e) {
    throw new Error(e);
  }
};

const fetchTutors = async () => {
  try {
    return axios.get("/tutors").then(({ data }) => data);
  } catch (e) {
    throw new Error(e);
  }
};

const addClient = async (client) => {
  try {
    return axios.post("/clients", client);
  } catch (e) {
    throw new Error(e);
  }
};

const removeClient = async (id) => {
  try {
    return axios.delete(`/clients/${id}`);
  } catch (e) {
    throw new Error(e);
  }
};

const addPaymentToClient = async (id, client) => {
  try {
    return axios.put(`/clients/${id}`, client);
  } catch (e) {
    throw new Error(e);
  }
};

const notebookAPI = {
  fetchClients,
  fetchTutors,
  addClient,
  removeClient,
  addPaymentToClient,
};
module.exports = notebookAPI;
