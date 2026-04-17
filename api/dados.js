import axios from 'axios';

export default async function handler(req, res) {
  const gistId = process.env.GITHUB_GIST_ID;
  const token = process.env.GITHUB_TOKEN;
  const fileName = process.env.GITHUB_FILENAME || "data.json";

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json'
  };

  try {
    // === LÓGICA DE LEITURA (GET) ===
    if (req.method === "GET") {
      const response = await axios.get(`https://api.github.com/gists/${gistId}`, { headers });
      const gist = response.data;
      const file = gist.files && gist.files[fileName];
      
      if (!file) throw new Error('Arquivo não encontrado no gist');

      let jsonText = file.content;
      
      // Lida com arquivos grandes truncados
      if (file.truncated && file.raw_url) {
        const rawResp = await axios.get(file.raw_url, { headers });
        jsonText = typeof rawResp.data === 'string' ? rawResp.data : JSON.stringify(rawResp.data);
      }

      return res.status(200).json(JSON.parse(jsonText));
    }

    // === LÓGICA DE ATUALIZAÇÃO (PATCH) ===
    if (req.method === "PATCH") {
      const newData = req.body; // Os novos dados enviados pelo React

      await axios.patch(`https://api.github.com/gists/${gistId}`, {
        files: {
          [fileName]: {
            content: JSON.stringify(newData, null, 2)
          }
        }
      }, { headers });

      return res.status(200).json({ message: "Dados atualizados com sucesso" });
    }

    // Se não for GET nem PATCH
    return res.status(405).json({ error: "Método não permitido" });

  } catch (error) {
    console.error("Erro na API:", error.response?.data || error.message);
    return res.status(500).json({ error: "Erro ao comunicar com o GitHub" });
  }
}