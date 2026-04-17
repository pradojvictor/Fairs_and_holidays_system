// Arquivo: src/services/api.js
import axios from 'axios';

// Agora chamamos a nossa Serverless Function local (ou da Vercel em produção)
export const fetchGistData = async () => {
  try {
    const response = await axios.get('/api/dados');
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    throw error;
  }
};

export const updateGistData = async (newData) => {
  try {
    const response = await axios.patch('/api/dados', newData);
    return response.data;
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
    throw error;
  }
};