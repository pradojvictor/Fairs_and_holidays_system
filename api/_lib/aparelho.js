// Computadores do painel: nome e PIN. É o desenho do SAMU (auditoria §5-C5): o computador é o
// "onde", o PIN é o "quem" — e o PIN nunca vale sozinho.
//
// Quando o admin entra com usuário e senha completos, o computador ganha um cookie próprio
// (`__Host-aparelho`): longo, HttpOnly, separado do da sessão. Esse cookie sozinho não abre
// nada e não diz quem é a pessoa; ele só deixa o PIN ser usado ali. Pela internet, sem ele, o
// servidor nem aceita PIN. No Gist (aparelhos.json) ficam só o SHA-256 do cookie, o nome que o
// admin der ao computador e o hash do PIN (scrypt, como as senhas).
//
// O PIN deixa de valer: 5 erros seguidos naquele computador (aí ele é apagado, e só a senha
// entra); 90 dias sem entrar ali com a senha; troca da senha do admin; "Remover PIN" ou
// "Esquecer" na aba Sessões. Com 6 dígitos e 5 tentativas, um chute cego acerta com chance de
// 1 em 200 mil — e só de dentro daquele computador.
//
// O Gist não tem transação: cada mudança relê e confere se ficou (como as sessões, §5-C14).
import { createHash, randomBytes } from 'node:crypto';
import { ARQUIVO_APARELHOS, alterarArquivoConferindo } from './gist.js';
import { anexarCookie } from './http.js';

export const DIGITOS_PIN = 6;
export const ERROS_ATE_BLOQUEAR = 5;
const DIA_MS = 24 * 60 * 60 * 1000;
// O PIN vale por 90 dias desde a última vez que alguém entrou naquele computador com a senha.
export const VALIDADE_PIN_MS = 90 * DIA_MS;
const DURACAO_COOKIE_S = 365 * 24 * 60 * 60;
// Teto da lista: os computadores usados há mais tempo saem primeiro.
const MAX_APARELHOS = 30;
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

function cookieSeguro() {
  return process.env.COOKIE_SEGURO !== 'nao';
}

function nomeCookie() {
  return cookieSeguro() ? '__Host-aparelho' : 'aparelho';
}

const hashDoToken = (token) => createHash('sha256').update(token).digest('hex');

// O id que a aba mostra e usa: o começo do hash. Não é segredo e não leva ao cookie.
export const idDoAparelho = (registro) => String(registro?.hash || '').slice(0, 16);

function montarCookie(valor, maxAgeSegundos) {
  const partes = [`${nomeCookie()}=${valor}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (cookieSeguro()) partes.push('Secure');
  partes.push(`Max-Age=${maxAgeSegundos}`);
  return partes.join('; ');
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

export const temCookieDeAparelho = (req) => tokenDoPedido(req) !== null;

export function lerAparelhosJson(texto) {
  try {
    const lista = JSON.parse(texto)?.aparelhos;
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export const aparelhosDaLeitura = (leitura) => lerAparelhosJson(leitura.arquivos?.[ARQUIVO_APARELHOS] || '');

// O computador deste pedido, se ele está na lista.
export function aparelhoDoPedido(req, leitura) {
  const token = tokenDoPedido(req);
  if (!token) return null;
  const hash = hashDoToken(token);
  return aparelhosDaLeitura(leitura).find((a) => a.hash === hash) || null;
}

export function pinValeAte(aparelho) {
  const desde = Date.parse(aparelho?.senhaEm || '');
  return Number.isNaN(desde) ? null : new Date(desde + VALIDADE_PIN_MS).toISOString();
}

export function pinVale(aparelho, agora = Date.now()) {
  const ate = pinValeAte(aparelho);
  return Boolean(aparelho?.pinHash) && (aparelho.errosPin || 0) < ERROS_ATE_BLOQUEAR && ate !== null && Date.parse(ate) > agora;
}

// A mesma frase para todo motivo de recusa (§5-C6).
export const MENSAGEM_PIN_RECUSADO =
  `PIN não aceito. Use ${DIGITOS_PIN} números, sem repetição (111111, 121212) e sem sequência (123456, 654321).`;

// PIN fraco é o que alguém chutaria primeiro: poucos dígitos diferentes, sequência, metade repetida.
export function pinAceitavel(pin) {
  if (!new RegExp(`^\\d{${DIGITOS_PIN}}$`).test(pin)) return false;
  const d = [...pin].map(Number);
  if (new Set(d).size <= 2) return false;
  const passos = d.slice(1).map((n, i) => n - d[i]);
  if (passos.every((p) => p === 1) || passos.every((p) => p === -1)) return false;
  if (pin.slice(0, 3) === pin.slice(3)) return false;
  return true;
}

async function alterarAparelhos(transformar, conferir, leitura) {
  await alterarArquivoConferindo(
    ARQUIVO_APARELHOS,
    (l) => aparelhosDaLeitura(l),
    (lista) => ({ aparelhos: transformar(lista) }),
    conferir,
    leitura,
  );
}

const marcaNova = () => `${new Date().toISOString()}#${randomBytes(3).toString('hex')}`;

// Aplica `mudar` ao registro DESTE computador; se ele ainda não está na lista, cria o registro
// e o cookie. Renova o prazo do cookie a cada uso. Devolve o registro como ficou.
export async function alterarEsteAparelho(req, res, leitura, mudar) {
  const marca = marcaNova();
  const existente = aparelhoDoPedido(req, leitura);
  let token = existente ? tokenDoPedido(req) : null;
  let hash = existente?.hash;
  if (!existente) {
    token = randomBytes(32).toString('base64url');
    hash = hashDoToken(token);
  }
  let resultado = null;
  await alterarAparelhos(
    (lista) => {
      const atual = lista.find((a) => a.hash === hash)
        || { hash, nome: '', criadoEm: new Date().toISOString(), errosPin: 0 };
      resultado = { ...mudar(atual), hash, marca };
      const outros = lista
        .filter((a) => a.hash !== hash)
        .sort((a, b) => String(b.usoEm || '').localeCompare(String(a.usoEm || '')))
        .slice(0, MAX_APARELHOS - 1);
      return [...outros, resultado];
    },
    (lista) => lista.some((a) => a.hash === hash && a.marca === marca),
    leitura,
  );
  anexarCookie(res, montarCookie(token, DURACAO_COOKIE_S));
  return resultado;
}

// Aplica `mudar` ao computador `id` (da aba Sessões). `mudar` devolvendo null tira o computador
// da lista. Devolve false se o id não existe.
export async function alterarAparelhoPorId(id, mudar, leitura) {
  const alvo = aparelhosDaLeitura(leitura).find((a) => idDoAparelho(a) === id);
  if (!alvo) return false;
  const marca = marcaNova();
  let removido = false;
  await alterarAparelhos(
    (lista) => lista.flatMap((a) => {
      if (a.hash !== alvo.hash) return [a];
      const novo = mudar(a);
      if (!novo) {
        removido = true;
        return [];
      }
      return [{ ...novo, hash: a.hash, marca }];
    }),
    (lista) => (removido
      ? !lista.some((a) => a.hash === alvo.hash)
      : !lista.some((a) => a.hash === alvo.hash) || lista.some((a) => a.hash === alvo.hash && a.marca === marca)),
    leitura,
  );
  return true;
}

// Troca de senha do admin: todo PIN deixa de valer. Os nomes dos computadores ficam.
export async function revogarTodosOsPins(leitura) {
  if (leitura && !aparelhosDaLeitura(leitura).some((a) => a.pinHash)) return;
  await alterarAparelhos(
    (lista) => lista.map(({ pinHash, pinDefinidoEm, ...resto }) => ({ ...resto, errosPin: 0 })), // eslint-disable-line no-unused-vars
    (lista) => !lista.some((a) => a.pinHash),
    leitura,
  );
}

// Um computador como a aba mostra: sem hash do cookie, sem hash do PIN.
export function visaoAparelho(a, atual) {
  return {
    id: idDoAparelho(a),
    nome: a.nome || '',
    descricao: a.descricao || '',
    criadoEm: a.criadoEm || null,
    senhaEm: a.senhaEm || null,
    usoEm: a.usoEm || a.criadoEm || null,
    pin: pinVale(a),
    pinValeAte: a.pinHash ? pinValeAte(a) : null,
    pinBloqueadoEm: a.pinBloqueadoEm || null,
    atual: Boolean(atual && a.hash === atual.hash),
  };
}
