// Senha com scrypt (padrão 1.1). O texto guardado carrega os parâmetros, para o custo
// poder subir depois sem invalidar hash antigo:
//   scrypt$32768$8$1$<salt base64>$<hash base64>
//
// `maxmem` é obrigatório: com N = 2^15 e r = 8, 128·N·r dá exatamente 32 MB, o teto padrão,
// e o OpenSSL recusa no limite (caso B1 da auditoria). Conferido no Node 24.16.
//
// Não existe ramo de texto puro: senha que não é hash scrypt simplesmente não confere.
// As senhas antigas viram hash pelo scripts/migrar-senhas.mjs.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 2 ** 15;
const R = 8;
const P = 1;
const TAMANHO = 64;
const maxmem = (n, r) => 128 * n * r * 2;

const FORMATO = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9+/]+=*)\$([A-Za-z0-9+/]+=*)$/;

export function ehHashScrypt(valor) {
  const m = typeof valor === 'string' && valor.match(FORMATO);
  if (!m) return false;
  const [n, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return n >= 2 ** 14 && n <= 2 ** 20 && (n & (n - 1)) === 0 && r >= 1 && r <= 32 && p >= 1 && p <= 4;
}

export async function gerarHash(senha) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(senha, salt, TAMANHO, { N, r: R, p: P, maxmem: maxmem(N, R) });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

// Hash de uma senha que ninguém conhece, gerado ao carregar o módulo: matrícula inexistente
// também paga o scrypt, e o tempo de resposta não revela quem existe.
const hashFantasma = gerarHash(randomBytes(32).toString('hex'));

export async function conferirSenha(senha, guardado) {
  const valido = ehHashScrypt(guardado);
  const alvo = valido ? guardado : await hashFantasma;
  const [, n, r, p, saltB64, hashB64] = alvo.match(FORMATO);
  const esperado = Buffer.from(hashB64, 'base64');
  const obtido = await scryptAsync(String(senha), Buffer.from(saltB64, 'base64'), esperado.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: maxmem(Number(n), Number(r)),
  });
  return timingSafeEqual(obtido, esperado) && valido;
}
