// Novidades do sistema: vêm das issues do repositório no GitHub, para publicar sem deploy e
// sem pesar no Gist. Só entram issues com a etiqueta `novidade` E abertas pelo dono do
// repositório. O repositório é público e qualquer um abre issue, mas só quem tem permissão põe
// etiqueta: os dois filtros juntos impedem uma "atualização" falsa na tela do operador.
//
// Como escrever uma novidade (GitHub → Issues → New issue, com a etiqueta `novidade`):
//   título → o título da notificação;
//   corpo  → o primeiro parágrafo é o resumo; os parágrafos seguintes aparecem como texto;
//            cada linha que começa com "- " vira um item ("- Título curto: explicação").
//   Fechar a issue não tira a novidade do ar; para tirar, remova a etiqueta.
//
// Mudança grande (regra nova, funcionalidade nova): ponha também a etiqueta `importante`. Aí,
// além de ir para o sino, ela abre sozinha num pop-up na primeira vez que alguém entra em cada
// computador depois de publicada (o "já vi" fica no navegador, como o "lido").
//
// O texto vai para a tela como texto puro (padrão 1.8): nenhum HTML vindo do GitHub é
// interpretado. A lista fica 10 minutos em cache; se o GitHub não responder, o painel segue
// funcionando, só sem novidades novas.

const REPO = process.env.NOVIDADES_REPO || 'pradojvictor/Fairs_and_holidays_system';
const AUTOR = process.env.NOVIDADES_AUTOR || 'pradojvictor';
const ETIQUETA = 'novidade';
const ETIQUETA_IMPORTANTE = 'importante';
const CACHE_MS = 10 * 60 * 1000;
const NOVA_TENTATIVA_MS = 60 * 1000;

let cache = { valeAte: 0, lista: [] };

// Usado pelos testes, para cada um começar sem cache.
export function limparCacheNovidades() {
  cache = { valeAte: 0, lista: [] };
}

// Tira a marcação mais comum de Markdown; o resto fica como texto.
const limpar = (s) => s.replace(/^#+\s*/, '').replace(/\*\*|__|`/g, '').trim();

export function interpretarIssue(issue) {
  const corpo = String(issue.body || '').replace(/\r\n/g, '\n').slice(0, 6000);
  const itens = [];
  const resto = [];
  for (const linha of corpo.split('\n')) {
    const item = linha.match(/^\s*[-*]\s+(.+)$/);
    if (!item) {
      resto.push(linha);
      continue;
    }
    const texto = limpar(item[1]);
    const separador = texto.indexOf(': ');
    itens.push(separador > 0 && separador <= 60
      ? { titulo: texto.slice(0, separador), texto: texto.slice(separador + 2) }
      : { titulo: '', texto });
  }
  const paragrafos = resto.join('\n').split(/\n\s*\n/).map((p) => limpar(p.replace(/\s+/g, ' '))).filter(Boolean);
  const etiquetas = (issue.labels || []).map((l) => l?.name ?? l);
  return {
    id: `novidade:issue-${issue.number}`,
    data: String(issue.created_at || '').slice(0, 10),
    importante: etiquetas.includes(ETIQUETA_IMPORTANTE),
    titulo: limpar(String(issue.title || '')).slice(0, 200),
    resumo: paragrafos[0] || '',
    paragrafos: paragrafos.slice(1, 10),
    itens: itens.slice(0, 30),
  };
}

async function pedirIssues(comToken) {
  const url = `https://api.github.com/repos/${REPO}/issues?labels=${ETIQUETA}&state=all&creator=${encodeURIComponent(AUTOR)}&per_page=30&sort=created&direction=desc`;
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (comToken && process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(url, { headers, signal: AbortSignal.timeout(4000) });
}

export async function buscarNovidades(agora = Date.now()) {
  if (agora < cache.valeAte) return cache.lista;
  try {
    let resposta = await pedirIssues(true);
    // Token restrito ao Gist pode não ler o repositório: o repositório é público, então lê sem token.
    if (resposta.status === 401 || resposta.status === 403) resposta = await pedirIssues(false);
    if (!resposta.ok) throw new Error(`GitHub respondeu ${resposta.status}`);
    const issues = await resposta.json();
    const lista = (Array.isArray(issues) ? issues : [])
      .filter((i) => !i.pull_request && i.user?.login === AUTOR && (i.labels || []).some((l) => (l?.name ?? l) === ETIQUETA))
      .map(interpretarIssue);
    cache = { valeAte: agora + CACHE_MS, lista };
  } catch (erro) {
    console.error('Novidades do GitHub indisponíveis:', erro.message);
    cache = { valeAte: agora + NOVA_TENTATIVA_MS, lista: cache.lista };
  }
  return cache.lista;
}
