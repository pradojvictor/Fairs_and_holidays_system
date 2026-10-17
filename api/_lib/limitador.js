// Limite de erros de senha (padrão 1.7), usado no login e em toda conferência de senha
// fora dele (regra A2 da auditoria: a busca por `conferirSenha` só pode achar rota com isto).
//
// Na Vercel cada instância tem memória própria: isto segura o chute em sequência, não um
// ataque espalhado entre instâncias. Para esse, uma regra de rate limit em /api/login no
// Firewall da Vercel. As chaves seguem a regra C9:
// - por conta: só conta erro de conta que existe, e o id vem do cadastro — o cliente não planta chave;
// - por IP: na Vercel, o x-real-ip, que a própria Vercel reescreve; fora dela, o socket.
//   Nenhum cabeçalho que o cliente escolhe. O Map tem expurgo e teto.
const JANELA_MS = 15 * 60 * 1000;
const LIMITE = { ip: 10, conta: 5 };
const TETO = 5000;
const erros = new Map(); // chave → { n, desde }

export function ipDoPedido(req) {
  if (process.env.VERCEL) {
    const ip = req.headers?.['x-real-ip'];
    if (typeof ip === 'string' && ip) return ip;
  }
  return req.socket?.remoteAddress || 'desconhecido';
}

function expurgar(agora) {
  for (const [chave, v] of erros) {
    if (agora - v.desde > JANELA_MS) erros.delete(chave);
  }
  // Map guarda ordem de inserção: o que sai primeiro é o mais antigo.
  while (erros.size > TETO) erros.delete(erros.keys().next().value);
}

const tipo = (chave) => chave.split(':')[0];

export function estaBloqueado(chaves) {
  const agora = Date.now();
  expurgar(agora);
  return chaves.some((chave) => (erros.get(chave)?.n || 0) >= LIMITE[tipo(chave)]);
}

export function registrarErro(chaves) {
  const agora = Date.now();
  for (const chave of chaves) {
    const atual = erros.get(chave);
    if (atual) atual.n += 1;
    else erros.set(chave, { n: 1, desde: agora });
  }
  expurgar(agora);
}

export function limparConta(chaveConta) {
  erros.delete(chaveConta);
}
