// O "lido" das notificações, guardado no navegador (src/components/Notificacoes/lidas.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aplicarLidas, lerLidas, marcarLidas, salvarLidas } from '../src/components/Notificacoes/lidas.js';

const agora = new Date('2026-10-18T12:00:00Z');

test('marcar como lida guarda o momento e não mexe no que já estava lido', () => {
  const antes = { a: '2026-10-01T00:00:00.000Z' };
  const depois = marcarLidas(antes, ['a', 'b'], new Set(['a', 'b']), agora);
  assert.deepEqual(depois, { a: '2026-10-01T00:00:00.000Z', b: '2026-10-18T12:00:00.000Z' });
  assert.deepEqual(antes, { a: '2026-10-01T00:00:00.000Z' }, 'não altera o objeto recebido');
});

test('poda: o que saiu da lista há mais de 120 dias é esquecido; o que ainda aparece fica', () => {
  const lidas = { velhaFora: '2026-05-01T00:00:00.000Z', velhaNaLista: '2026-05-01T00:00:00.000Z', recenteFora: '2026-10-10T00:00:00.000Z' };
  const depois = marcarLidas(lidas, [], new Set(['velhaNaLista']), agora);
  assert.deepEqual(Object.keys(depois).sort(), ['recenteFora', 'velhaNaLista']);
});

test('aplicar: cada notificação ganha lida e lidaEm do navegador', () => {
  const lista = aplicarLidas([{ id: 'a' }, { id: 'b' }], { a: '2026-10-18T12:00:00.000Z' });
  assert.deepEqual(lista, [{ id: 'a', lida: true, lidaEm: '2026-10-18T12:00:00.000Z' }, { id: 'b', lida: false, lidaEm: null }]);
});

test('sem localStorage (bloqueado), ler devolve vazio e salvar não quebra', () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  try {
    assert.deepEqual(lerLidas(), {});
    assert.doesNotThrow(() => salvarLidas({ a: 'x' }));
  } finally {
    globalThis.localStorage = original;
  }
});

test('com localStorage, o que foi salvo volta igual', () => {
  const guardado = {};
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => guardado[k] ?? null, setItem: (k, v) => { guardado[k] = v; } };
  try {
    salvarLidas({ a: '2026-10-18T12:00:00.000Z' });
    assert.deepEqual(lerLidas(), { a: '2026-10-18T12:00:00.000Z' });
  } finally {
    globalThis.localStorage = original;
  }
});
