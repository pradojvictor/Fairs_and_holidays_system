// O que já foi lido fica no navegador (localStorage), por computador: o mesmo login aberto em
// outro computador vê as notificações como novas. Assim quem testa aqui não some com o aviso
// de quem usa o sistema lá.
//
// Se o navegador bloquear o armazenamento (aba anônima, política da empresa), o "lido" vale só
// enquanto a página estiver aberta — nada quebra.
const CHAVE = 'sistema-ferias:notificacoes-lidas';
const DIAS_GUARDANDO = 120;

export function lerLidas() {
  try {
    const valor = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
  } catch {
    return {};
  }
}

export function salvarLidas(lidas) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lidas));
  } catch {
    // Armazenamento bloqueado: fica só na memória desta aba.
  }
}

// Marca os ids como lidos agora. Aproveita para podar: o que não está mais na lista sai depois
// de 120 dias, para o armazenamento não crescer para sempre.
export function marcarLidas(lidas, ids, idsAtuais, agora = new Date()) {
  const limite = agora.getTime() - DIAS_GUARDANDO * 86_400_000;
  const novas = {};
  for (const [id, quando] of Object.entries(lidas)) {
    if (idsAtuais.has(id) || Date.parse(quando) > limite) novas[id] = quando;
  }
  for (const id of ids) novas[id] ||= agora.toISOString();
  return novas;
}

export function aplicarLidas(notificacoes, lidas) {
  return notificacoes.map((n) => ({ ...n, lida: Boolean(lidas[n.id]), lidaEm: lidas[n.id] || null }));
}
