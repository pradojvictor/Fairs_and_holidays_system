// Sessão opaca, guardada no Gist (padrão 0.1). O cookie leva 32 bytes aleatórios; o Gist
// guarda só o SHA-256. Quem ler o Gist inteiro, histórico incluído, não monta um cookie.
// Revogável por construção: logout, troca de senha e exclusão tiram a linha do arquivo.
//
// O que isto não resolve: o Gist não tem transação. Dois logins no mesmo segundo podem
// gravar um por cima do outro — por isso toda alteração relê o arquivo e confere se a
// mudança ficou, e repete se não ficou. Cada login vira uma revisão do Gist (com o hash,
// nunca com o token).
import { createHash, randomBytes } from 'node:crypto';
import { ARQUIVO_SESSOES, ErroDependencia, gravarArquivo, lerGist } from './gist.js';

const DURACAO_MS = 8 * 60 * 60 * 1000;
const MAX_POR_USUARIO = 5;
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

// COOKIE_SEGURO=nao só para `vercel dev` em http://localhost no Safari, que recusa cookie
// Secure fora de HTTPS. Sem a variável, o cookie é sempre __Host- + Secure.
function cookieSeguro() {
  return process.env.COOKIE_SEGURO !== 'nao';
}

function nomeCookie() {
  return cookieSeguro() ? '__Host-sessao' : 'sessao';
}

const hashDoToken = (token) => createHash('sha256').update(token).digest('hex');

function montarCookie(valor, apagar = false) {
  // Sem Max-Age: o cookie morre ao fechar o navegador. O prazo de 8h vale no servidor.
  const partes = [`${nomeCookie()}=${valor}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (cookieSeguro()) partes.push('Secure');
  if (apagar) partes.push('Max-Age=0');
  return partes.join('; ');
}

export function apagarCookie(res) {
  res.setHeader('Set-Cookie', montarCookie('', true));
}

function tokenDoPedido(req) {
  for (const parte of (req.headers?.cookie || '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nomeCookie()) {
      const token = parte.slice(i + 1).trim();
      return FORMATO_TOKEN.test(token) ? token : null;
    }
  }
  return null;
}

// Conferência barata, antes de ler o Gist: pedido sem cookie de sessão não gasta chamada
// ao GitHub (que tem cota por hora).
export function temCookieDeSessao(req) {
  return tokenDoPedido(req) !== null;
}

// Resolve a sessão do pedido sobre uma leitura do Gist. Quem é a pessoa e o que ela pode
// vêm do cadastro de agora, não da hora do login (regra C8): profissional apagado perde a
// sessão no mesmo instante, e supervisor rebaixado deixa de ver a equipe no próximo clique.
export function resolverSessao(req, { dados, sessoes }) {
  const token = tokenDoPedido(req);
  if (!token) return null;
  const hash = hashDoToken(token);
  const sessao = sessoes.find((s) => s.hash === hash);
  if (!sessao || !(Date.parse(sessao.expiraEm) > Date.now())) return null;

  if (sessao.papel === 'admin') {
    return dados.auth ? { hash, papel: 'admin', usuario: 'admin' } : null;
  }
  if (sessao.papel === 'colaborador') {
    const profissional = (dados.professionals || []).find((p) => p.id === sessao.usuario);
    if (!profissional) return null;
    return { hash, papel: 'colaborador', usuario: profissional.id, profissional, supervisor: profissional.isSupervisor === true };
  }
  return null;
}

// Aplica `transformar` ao sessoes.json, grava e relê até `conferir` aceitar o que ficou.
async function alterarSessoes(transformar, conferir, leituraInicial) {
  let leitura = leituraInicial || await lerGist();
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    await gravarArquivo(ARQUIVO_SESSOES, JSON.stringify({ sessoes: transformar(leitura.sessoes) }));
    leitura = await lerGist();
    if (conferir(leitura.sessoes)) return;
  }
  throw new ErroDependencia('Não foi possível gravar a sessão no Gist.');
}

export async function abrirSessao(res, papel, usuario, leitura) {
  const token = randomBytes(32).toString('base64url');
  const hash = hashDoToken(token);
  const agora = Date.now();
  const nova = {
    hash,
    papel,
    usuario,
    criadaEm: new Date(agora).toISOString(),
    expiraEm: new Date(agora + DURACAO_MS).toISOString(),
  };
  await alterarSessoes(
    (lista) => {
      // Expurgo no caminho: sessão vencida sai, e cada pessoa fica com no máximo 5 abertas.
      const vivas = lista.filter((s) => Date.parse(s.expiraEm) > agora && s.hash !== hash);
      const minhas = vivas
        .filter((s) => s.papel === papel && s.usuario === usuario)
        .sort((a, b) => Date.parse(a.criadaEm) - Date.parse(b.criadaEm));
      const sobra = new Set(minhas.slice(0, Math.max(0, minhas.length - (MAX_POR_USUARIO - 1))).map((s) => s.hash));
      return [...vivas.filter((s) => !sobra.has(s.hash)), nova];
    },
    (lista) => lista.some((s) => s.hash === hash),
    leitura,
  );
  res.setHeader('Set-Cookie', montarCookie(token));
}

// Encerra as sessões que `filtro` escolher (logout, troca de senha, exclusão de conta).
export async function encerrarSessoes(filtro, leitura) {
  if (leitura && !leitura.sessoes.some(filtro)) return;
  await alterarSessoes(
    (lista) => lista.filter((s) => !filtro(s)),
    (lista) => !lista.some(filtro),
    leitura,
  );
}
