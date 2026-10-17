// Leitura e escrita no Gist que guarda os dados do sistema.
//
// Dois arquivos do Gist importam aqui:
// - GITHUB_FILENAME (data.json): profissionais, eventos, cargos e a credencial do admin.
//   O SAME (SAME-BACK/src/ferias-sync.ts) lê este arquivo direto do GitHub e usa
//   professionals[].id/matricula/name e events[].professionalId/type/reason/startDate/endDate.
//   Esses campos não mudam de nome nem de formato.
// - sessoes.json: as sessões abertas, só com o hash do token (ver sessao.js). Fica separado
//   para que login e logout nunca reescrevam o data.json.
//
// O PATCH do Gist só altera os arquivos citados no corpo: gravar um não toca o outro.

const API = 'https://api.github.com/gists';
export const ARQUIVO_SESSOES = 'sessoes.json';

// GitHub fora do ar ou limitando: 503, com o nome da dependência (regra C4 da auditoria).
export class ErroDependencia extends Error {}
// Defeito nosso (variável faltando, Gist errado, token sem escopo): 500.
export class ErroConfiguracao extends Error {}
// O data.json mudou três vezes seguidas enquanto a operação tentava gravar: 409.
export class ErroConflito extends Error {}

function config() {
  const gistId = process.env.GITHUB_GIST_ID;
  const token = process.env.GITHUB_TOKEN;
  if (!gistId || !token) {
    throw new ErroConfiguracao('GITHUB_GIST_ID e GITHUB_TOKEN precisam estar definidas.');
  }
  return { gistId, token, arquivoDados: process.env.GITHUB_FILENAME || 'data.json' };
}

async function chamar(url, opcoes = {}) {
  const { token } = config();
  let resposta;
  try {
    resposta = await fetch(url, {
      method: opcoes.method || 'GET',
      body: opcoes.body,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (erro) {
    throw new ErroDependencia(`GitHub inacessível: ${erro.message}`);
  }
  const limitado = resposta.status === 429 ||
    (resposta.status === 403 && (resposta.headers.get('retry-after') || resposta.headers.get('x-ratelimit-remaining') === '0'));
  if (resposta.status >= 500 || limitado) {
    throw new ErroDependencia(`GitHub respondeu ${resposta.status}`);
  }
  if (!resposta.ok) {
    throw new ErroConfiguracao(`GitHub respondeu ${resposta.status} — confira GITHUB_GIST_ID e o escopo do GITHUB_TOKEN.`);
  }
  return resposta;
}

// Arquivo acima de 1 MB vem truncado na API; o raw_url aponta para a revisão exata.
async function conteudoDoArquivo(arquivo) {
  if (!arquivo.truncated) return arquivo.content;
  const resposta = await chamar(arquivo.raw_url);
  return resposta.text();
}

export function lerSessoesJson(texto) {
  try {
    const lista = JSON.parse(texto)?.sessoes;
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

// Uma leitura devolve os dois arquivos: é a mesma chamada à API.
export async function lerGist() {
  const { gistId, arquivoDados } = config();
  const gist = await (await chamar(`${API}/${gistId}`)).json();
  const arquivo = gist.files?.[arquivoDados];
  if (!arquivo) throw new ErroConfiguracao(`Arquivo ${arquivoDados} não encontrado no Gist.`);
  const textoDados = await conteudoDoArquivo(arquivo);
  const arquivoSessoes = gist.files?.[ARQUIVO_SESSOES];
  const textoSessoes = arquivoSessoes ? await conteudoDoArquivo(arquivoSessoes) : null;
  return {
    textoDados,
    dados: JSON.parse(textoDados),
    sessoes: textoSessoes ? lerSessoesJson(textoSessoes) : [],
  };
}

export async function gravarArquivo(nome, conteudo) {
  const { gistId } = config();
  await chamar(`${API}/${gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [nome]: { content: conteudo } } }),
  });
}

// Lê, transforma e grava o data.json. Antes de gravar, relê: se o arquivo mudou no meio do
// caminho (outra aba, outro computador), recomeça sobre a versão nova em vez de apagá-la.
// Sobra uma janela entre a releitura e o PATCH — o Gist não tem gravação condicional; só um
// banco de verdade fecha isso.
//
// `transformar` recebe uma cópia e devolve o documento novo inteiro; chaves que ela não
// conhece passam intactas, porque ela parte do documento lido.
export async function alterarDados(transformar, leituraInicial) {
  const { arquivoDados } = config();
  let leitura = leituraInicial || await lerGist();
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const resultado = transformar(structuredClone(leitura.dados));
    const atual = await lerGist();
    if (atual.textoDados === leitura.textoDados) {
      await gravarArquivo(arquivoDados, JSON.stringify(resultado, null, 2));
      return resultado;
    }
    leitura = atual;
  }
  throw new ErroConflito('Os dados mudaram enquanto você salvava. Recarregue a página e tente de novo.');
}
