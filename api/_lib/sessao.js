// Sessão opaca, guardada no Gist (padrão 0.1). O cookie leva 32 bytes aleatórios; o Gist
// guarda só o SHA-256. Quem ler o Gist inteiro, histórico incluído, não monta um cookie.
// Revogável por construção: logout, troca de senha e exclusão tiram a linha do arquivo.
//
// O que isto não resolve: o Gist não tem transação. Dois logins no mesmo segundo podem
// gravar um por cima do outro — por isso toda alteração relê o arquivo e confere se a
// mudança ficou, e repete se não ficou. Cada login vira uma revisão do Gist (com o hash,
// nunca com o token).
import { createHash, randomBytes } from 'node:crypto';
import { ARQUIVO_SESSOES, alterarArquivoConferindo } from './gist.js';

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
// Sem "manter conectado": cookie de sessão (morre ao fechar o navegador) e 8h no servidor.
const DURACAO_MS = 8 * HORA_MS;
// Com "manter conectado": vence depois de 30 dias sem uso. Cada dia de uso empurra o prazo,
// mas nunca além de 90 dias do login — um cookie copiado não vale para sempre.
const DURACAO_LEMBRAR_MS = 30 * DIA_MS;
const TETO_LEMBRAR_MS = 90 * DIA_MS;
// A renovação grava no Gist; no máximo uma vez por dia por sessão.
const RENOVAR_DEPOIS_MS = DIA_MS;
// Com sessões longas, cada pessoa acumula uma por navegador (computador, celular...).
const MAX_POR_USUARIO = 10;
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

// O id que a aba "Sessões ativas" mostra e usa para encerrar: o começo do SHA-256 guardado.
// Não é segredo (o Gist já guarda o hash inteiro) e não leva ao token.
export const idDaSessao = (registro) => String(registro?.hash || '').slice(0, 16);

// "Chrome · Windows": o bastante para o dono reconhecer o computador na lista. Só isso é
// guardado — nem o user-agent inteiro, nem o IP: o Gist guarda histórico para sempre, e IP é
// dado pessoal.
export function descreverAparelho(userAgent) {
  const ua = String(userAgent || '').slice(0, 500);
  const navegador = /Edg(A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
      : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
        : /Firefox\/|FxiOS/.test(ua) ? 'Firefox'
          : /Chrome\/|CriOS/.test(ua) ? 'Chrome'
            : /Safari\//.test(ua) ? 'Safari' : '';
  const sistema = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
      : /Android/.test(ua) ? 'Android'
        : /Windows/.test(ua) ? 'Windows'
          : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
            : /CrOS/.test(ua) ? 'Chromebook'
              : /Linux/.test(ua) ? 'Linux' : '';
  return [navegador, sistema].filter(Boolean).join(' · ');
}

// Sessões que ainda valem (as vencidas só esperam o próximo expurgo).
export const sessoesVivas = (sessoes, agora = Date.now()) => sessoes.filter((s) => Date.parse(s.expiraEm) > agora);

// Sem `maxAgeSegundos`, o cookie morre ao fechar o navegador. Com ele, o navegador guarda o
// cookie até a mesma data em que a sessão vence no servidor — quem manda é sempre o servidor.
function montarCookie(valor, maxAgeSegundos) {
  const partes = [`${nomeCookie()}=${valor}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (cookieSeguro()) partes.push('Secure');
  if (maxAgeSegundos !== undefined) partes.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSegundos))}`);
  return partes.join('; ');
}

export function apagarCookie(res) {
  res.setHeader('Set-Cookie', montarCookie('', 0));
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
    return dados.auth ? { hash, registro: sessao, papel: 'admin', usuario: 'admin' } : null;
  }
  if (sessao.papel === 'colaborador') {
    const profissional = (dados.professionals || []).find((p) => p.id === sessao.usuario);
    if (!profissional) return null;
    return { hash, registro: sessao, papel: 'colaborador', usuario: profissional.id, profissional, supervisor: profissional.isSupervisor === true };
  }
  return null;
}

// Aplica `transformar` ao sessoes.json, grava e relê até `conferir` aceitar o que ficou.
async function alterarSessoes(transformar, conferir, leituraInicial) {
  await alterarArquivoConferindo(
    ARQUIVO_SESSOES,
    (leitura) => leitura.sessoes,
    (lista) => ({ sessoes: transformar(lista) }),
    conferir,
    leituraInicial,
  );
}

export async function abrirSessao(res, papel, usuario, leitura, { lembrar = false, aparelho = '' } = {}) {
  const token = randomBytes(32).toString('base64url');
  const hash = hashDoToken(token);
  const agora = Date.now();
  const duracao = lembrar ? DURACAO_LEMBRAR_MS : DURACAO_MS;
  const nova = {
    hash,
    papel,
    usuario,
    criadaEm: new Date(agora).toISOString(),
    expiraEm: new Date(agora + duracao).toISOString(),
    ...(lembrar ? { lembrar: true } : {}),
    ...(aparelho ? { aparelho } : {}),
  };
  await alterarSessoes(
    (lista) => {
      // Expurgo no caminho: sessão vencida sai, e cada pessoa fica com no máximo 10 abertas.
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
  res.setHeader('Set-Cookie', montarCookie(token, lembrar ? duracao / 1000 : undefined));
}

// Prazo deslizante de "manter conectado": a cada dia de uso, a sessão volta a vencer em 30
// dias, até o teto de 90 dias do login. Só grava se passou um dia da última renovação, para
// não virar uma revisão do Gist a cada clique. Falhar aqui não derruba o pedido: a sessão
// continua valendo até o prazo que já tinha, e a próxima visita tenta de novo.
export async function renovarSessao(req, res, sessao, leitura) {
  const registro = sessao?.registro;
  if (!registro?.lembrar) return;
  const token = tokenDoPedido(req);
  if (!token) return;
  const agora = Date.now();
  const ultima = Date.parse(registro.renovadaEm || registro.criadaEm);
  if (agora - ultima < RENOVAR_DEPOIS_MS) return;
  const teto = Date.parse(registro.criadaEm) + TETO_LEMBRAR_MS;
  const novoPrazo = Math.min(agora + DURACAO_LEMBRAR_MS, teto);
  if (!(novoPrazo > Date.parse(registro.expiraEm))) return;

  const expiraEm = new Date(novoPrazo).toISOString();
  const renovadaEm = new Date(agora).toISOString();
  try {
    await alterarSessoes(
      // Só mexe na sessão se ela ainda existir: um logout no meio do caminho vence.
      (lista) => lista.map((s) => (s.hash === sessao.hash ? { ...s, expiraEm, renovadaEm } : s)),
      (lista) => {
        const atual = lista.find((s) => s.hash === sessao.hash);
        return !atual || atual.expiraEm === expiraEm;
      },
      leitura,
    );
  } catch (erro) {
    console.error('Renovação da sessão falhou:', erro?.message || erro);
    return;
  }
  res.setHeader('Set-Cookie', montarCookie(token, (novoPrazo - agora) / 1000));
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
