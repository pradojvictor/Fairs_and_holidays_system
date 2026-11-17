// O "lido" das notificações, guardado no navegador (src/components/Notificacoes/lidas.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aplicarLidas, importantesNaoVistas, juntarImportantes, lerLidas, marcarLidas, salvarLidas } from '../src/components/Notificacoes/lidas.js';

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

test('importantes não vistas: só sistema + importante + não lida, da mais antiga para a mais nova', () => {
  const lista = aplicarLidas([
    { id: 'nova-importante', categoria: 'sistema', importante: true, data: '2026-10-19' },
    { id: 'velha-importante', categoria: 'sistema', importante: true, data: '2026-09-01' },
    { id: 'ja-vista', categoria: 'sistema', importante: true, data: '2026-10-01' },
    { id: 'comum', categoria: 'sistema', importante: false, data: '2026-10-19' },
    { id: 'ferias', categoria: 'ferias', importante: true, data: '2026-10-19' },
  ], { 'ja-vista': '2026-10-02T00:00:00.000Z' });
  assert.deepEqual(importantesNaoVistas(lista).map((n) => n.id), ['velha-importante', 'nova-importante']);
});

test('importante que chega com o painel aberto entra na fila, sem repetir a que já está nela', () => {
  const a = { id: 'a', data: '2026-10-01' };
  const b = { id: 'b', data: '2026-11-17' };
  const c = { id: 'c', data: '2026-11-18' };
  const vazio = { fila: [], total: 0 };

  // Carga do painel: uma não vista abre como "1 de 1".
  let estado = juntarImportantes(vazio, [a]);
  assert.deepEqual(estado, { fila: [a], total: 1 });

  // Nada novo na busca seguinte: o mesmo estado (o React não redesenha).
  assert.equal(juntarImportantes(estado, [a]), estado);

  // Chega outra enquanto a primeira está aberta: vira "1 de 2".
  estado = juntarImportantes(estado, [a, b]);
  assert.deepEqual(estado, { fila: [a, b], total: 2 });

  // Fila esvaziada (as duas fechadas): a próxima começa uma sequência nova, "1 de 1".
  estado = juntarImportantes({ fila: [], total: 2 }, [c]);
  assert.deepEqual(estado, { fila: [c], total: 1 });
});
