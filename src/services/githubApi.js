// Arquivo: src/services/githubApi.js
// Conversa com a API do próprio sistema (pasta /api). A sessão vai num cookie HttpOnly que
// o JavaScript da página não lê: aqui não existe token nem "isAuthenticated" guardado.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, body) {
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Erro ao conectar com o servidor. Tente novamente.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error || 'Erro ao comunicar com o servidor.');
  }
  return data;
}

// tipo 'admin': { usuario, senha } · tipo 'colaborador': { matricula, senha }
export const login = (credentials) => request('POST', '/api/login', credentials);

export const logout = () => request('POST', '/api/logout', {});

// Devolve { perfil, professionals, events, professions } — o que a sessão pode ver.
export const fetchGistData = () => request('GET', '/api/dados');

// Toda escrita é uma operação nomeada; a lista está em api/_lib/operacoes.js.
export const runOperation = (op, dados) => request('POST', '/api/operacao', { op, dados });
