// O cálculo das férias por tempo de serviço, com datas fixas (shared/ferias.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aniversarioNoAno, aniversariosEntre, anoSugerido, hojeISO, pendenciasDoProfissional,
  pendenciasFerias, periodoAquisitivo, proximoAniversario, ultimoAniversario,
} from '../shared/ferias.js';

test('João, admitido em 23/02/2020, visto em 17/10/2026', () => {
  assert.equal(ultimoAniversario('2020-02-23', '2026-10-17'), '2026-02-23');
  assert.equal(proximoAniversario('2020-02-23', '2026-02-23'), '2027-02-23');
  assert.deepEqual(periodoAquisitivo('2020-02-23', '2027-02-23'), { inicio: '2026-02-23', fim: '2027-02-22', rotulo: '26-27' });
  // Ganha férias depois de 12 meses: a sugestão é sempre o ano que passou.
  assert.equal(anoSugerido('2027-02-23'), '2026');
});

test('quem entrou em 2025 tem a primeira entrada referente a 2025, 12 meses depois', () => {
  const ana = { id: 'p_ana', dataAdmissao: '2025-05-10' };
  assert.deepEqual(pendenciasDoProfissional(ana, '2026-05-09'), [], 'um dia antes de completar 12 meses, nada');
  assert.deepEqual(pendenciasDoProfissional(ana, '2026-05-10'), [{
    professionalId: 'p_ana',
    aniversario: '2026-05-10',
    periodo: { inicio: '2025-05-10', fim: '2026-05-09', rotulo: '25-26' },
    anoSugerido: '2025',
    dias: 30,
  }]);
});

test('a contagem segue do último aniversário resolvido, não da data de hoje', () => {
  const joao = { id: 'p_joao', dataAdmissao: '2020-02-23', feriasAniversarioAte: '2026-02-23' };
  assert.deepEqual(pendenciasDoProfissional(joao, '2026-10-17'), []);
  assert.deepEqual(pendenciasDoProfissional(joao, '2027-02-22'), []);
  assert.deepEqual(pendenciasDoProfissional(joao, '2027-02-23').map((p) => p.aniversario), ['2027-02-23']);
  // Sistema sem abrir por dois anos: as duas aparecem, da mais antiga para a mais nova.
  assert.deepEqual(pendenciasDoProfissional(joao, '2028-03-01').map((p) => p.aniversario), ['2027-02-23', '2028-02-23']);
});

test('admissão em 29/02 faz aniversário em 28/02 nos anos sem 29', () => {
  assert.equal(aniversarioNoAno('2020-02-29', 2021), '2021-02-28');
  assert.equal(aniversarioNoAno('2020-02-29', 2024), '2024-02-29');
  assert.deepEqual(aniversariosEntre('2020-02-29', '2020-02-29', '2024-12-31'), ['2021-02-28', '2022-02-28', '2023-02-28', '2024-02-29']);
  assert.deepEqual(periodoAquisitivo('2020-02-29', '2021-02-28'), { inicio: '2020-02-29', fim: '2021-02-27', rotulo: '20-21' });
});

test('sem data de admissão, o sistema não pergunta nada', () => {
  assert.deepEqual(pendenciasDoProfissional({ id: 'x' }, '2026-10-17'), []);
  assert.deepEqual(pendenciasDoProfissional({ id: 'x', dataAdmissao: 'inválida' }, '2026-10-17'), []);
});

test('a lista geral vem ordenada pela data do aniversário', () => {
  const lista = pendenciasFerias([
    { id: 'b', dataAdmissao: '2024-09-01' },
    { id: 'a', dataAdmissao: '2025-03-15' },
  ], '2026-10-17');
  assert.deepEqual(lista.map((p) => `${p.professionalId}@${p.aniversario}`), ['b@2025-09-01', 'a@2026-03-15', 'b@2026-09-01']);
});

test('"hoje" é o dia em Teresina, não em UTC', () => {
  // 02h UTC do dia 18 ainda é 23h do dia 17 em Teresina (UTC-3).
  assert.equal(hojeISO(new Date('2026-10-18T02:00:00Z')), '2026-10-17');
});
