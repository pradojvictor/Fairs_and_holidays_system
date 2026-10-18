// Central de notificações do admin. Três categorias:
// - sistema: novidades do sistema (issues do GitHub, ver novidades.js) → abrem num modal;
// - ferias:  períodos de 12 meses vencidos que o operador ainda não resolveu, e o registro do
//            que ele lançou ou marcou como "já lançado" → abrem numa gaveta;
// - escala:  ausências que começam nos próximos 7 dias (ou começaram nos últimos 7) e alertas
//            de cobertura — 2 ou mais do mesmo cargo e turno fora no mesmo dia → gaveta.
//
// Quase tudo é calculado na hora, a partir dos dados: o Gist guarda só o arquivo pequeno
// notificacoes.json, com o registro das férias resolvidas.
// O que já foi lido NÃO fica aqui: fica no navegador (localStorage), por computador — quem
// testa num computador não apaga a notificação de quem usa o mesmo login em outro.
// O motivo de atestado (dado de saúde) nunca entra numa notificação.
import { dataBR, pendenciasFerias } from '../../shared/ferias.js';

export const ARQUIVO_NOTIFICACOES = 'notificacoes.json';
export const CATEGORIAS = ['sistema', 'ferias', 'escala'];

const JANELA_ESCALA_DIAS = 7;
const MAX_HISTORICO = 200;
const DIAS_NO_HISTORICO = 120;
const DIA_MS = 86_400_000;

const lista = (v) => (Array.isArray(v) ? v : []);
const somarDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const diasEntre = (inicio, fim) => Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / DIA_MS) + 1;
const nomeTurno = (s) => ({ dia_todo: 'Dia todo', manhã: 'Manhã', tarde: 'Tarde' }[s] || s || 'sem turno');
const nomeTipo = (t) => ({ ferias: 'Férias', folga: 'Folga', atestado: 'Atestado' }[t] || 'Ausência');
const periodoBR = (inicio, fim) => (inicio === fim ? dataBR(inicio) : `${dataBR(inicio)} a ${dataBR(fim)}`);

// Arquivos antigos podem ter um campo `lidas` (do tempo em que o servidor guardava isso): ele é
// ignorado e some na próxima gravação.
export function lerEstadoNotificacoes(texto) {
  try {
    return { historico: lista(JSON.parse(texto || '{}')?.historico) };
  } catch {
    return { historico: [] };
  }
}

function contexto(dados) {
  const profissionais = lista(dados.professionals);
  const cargos = lista(dados.professions);
  const pro = (id) => profissionais.find((p) => p.id === id);
  const cargo = (p) => cargos.find((c) => c.id === p?.professionId)?.name || 'Sem cargo';
  return { profissionais, pro, cargo };
}

function deSistema(novidades) {
  return novidades.map((n) => ({
    id: n.id,
    categoria: 'sistema',
    tipo: 'novidade',
    data: n.data,
    quando: n.data,
    titulo: n.titulo,
    resumo: n.resumo,
    paragrafos: n.paragrafos,
    itens: n.itens,
  }));
}

function saldoFeriasTexto(p) {
  const saldos = {};
  for (const l of lista(p?.bancoFerias)) {
    saldos[l.year] = (saldos[l.year] || 0) + (l.type === 'saida' ? -l.days : l.days);
  }
  const partes = Object.entries(saldos).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([ano, d]) => `${ano}: ${d} dias`);
  return partes.length ? partes.join(' · ') : 'nenhum lote no banco ainda';
}

function deFeriasPendentes(dados, hoje, ctx) {
  const pendencias = pendenciasFerias(dados.professionals, hoje);
  return pendencias.map((p) => {
    const pro = ctx.pro(p.professionalId);
    const nome = pro?.name || 'Profissional';
    const daPessoa = pendencias.filter((q) => q.professionalId === p.professionalId);
    const antes = daPessoa.findIndex((q) => q.aniversario === p.aniversario);
    return {
      id: `ferias:${p.professionalId}:${p.aniversario}`,
      categoria: 'ferias',
      tipo: 'ferias-a-lancar',
      data: p.aniversario,
      quando: p.aniversario,
      titulo: `${nome} completou mais 12 meses de trabalho`,
      resumo: `O período ${p.periodo.rotulo} fechou em ${dataBR(p.aniversario)}: ${p.dias} dias de férias a lançar, sugeridos como ${p.anoSugerido}.`,
      professionalId: p.professionalId,
      detalhes: [
        { rotulo: 'Profissional', valor: nome },
        { rotulo: 'Cargo e turno', valor: `${ctx.cargo(pro)} · ${nomeTurno(pro?.shift)}` },
        { rotulo: 'Admissão', valor: dataBR(pro?.dataAdmissao) },
        { rotulo: 'Período aquisitivo', valor: `${periodoBR(p.periodo.inicio, p.periodo.fim)} (${p.periodo.rotulo})` },
        { rotulo: 'Completou 12 meses em', valor: dataBR(p.aniversario) },
        { rotulo: 'Dias a lançar', valor: `${p.dias} dias` },
        { rotulo: 'Ano sugerido', valor: `${p.anoSugerido} — o ano que passou; dá para trocar na hora de lançar` },
        { rotulo: 'Saldo de férias hoje', valor: saldoFeriasTexto(pro) },
        ...(antes > 0 ? [{ rotulo: 'Ordem', valor: `Resolva antes o período que fechou em ${dataBR(daPessoa[0].aniversario)}` }] : []),
      ],
      orientacao: 'O sistema não lança sozinho. Em "Ir para o lançamento", confira o ano e os dias e confirme — ou marque "já lançado" se você lançou essas férias à mão.',
      acao: { tipo: 'lancar-ferias', rotulo: 'Ir para o lançamento' },
    };
  });
}

function deHistorico(estado, hoje) {
  const limite = somarDias(hoje, -DIAS_NO_HISTORICO);
  return estado.historico
    .filter((h) => String(h.criadaEm || '').slice(0, 10) >= limite)
    .map((h) => {
      const dia = String(h.criadaEm).slice(0, 10);
      const lancada = h.tipo === 'ferias-lancada';
      return {
        id: h.id,
        categoria: 'ferias',
        tipo: h.tipo,
        data: dia,
        quando: dia,
        titulo: lancada
          ? `Férias lançadas: ${h.nome} +${h.days} dias (${h.year})`
          : `Período ${h.rotulo} de ${h.nome} marcado como já lançado`,
        resumo: lancada
          ? `Período ${h.rotulo} lançado em ${dataBR(dia)} como férias de ${h.year}.`
          : `Nenhum dia foi acrescentado: o operador indicou que essas férias já estavam no banco.`,
        professionalId: h.professionalId,
        detalhes: [
          { rotulo: 'Profissional', valor: h.nome },
          { rotulo: 'Período aquisitivo', valor: `${h.periodo} (${h.rotulo})` },
          { rotulo: 'Completou 12 meses em', valor: dataBR(h.aniversario) },
          ...(lancada ? [{ rotulo: 'Lançado', valor: `+${h.days} dias, referentes a ${h.year}` }] : [{ rotulo: 'Resultado', valor: 'Marcado como já lançado (sem acrescentar dias)' }]),
          { rotulo: 'Quando', valor: dataBR(dia) },
        ],
        orientacao: lancada
          ? 'Registro do que foi feito. Se o ano ou os dias estiverem errados, corrija no Banco de Férias.'
          : 'Registro do que foi feito. Se os dias não estiverem no banco, lance no Banco de Férias.',
        acao: { tipo: 'banco-ferias', rotulo: 'Abrir o Banco de Férias' },
      };
    });
}

function deAusencias(dados, hoje, ctx) {
  const inicioJanela = somarDias(hoje, -JANELA_ESCALA_DIAS);
  const fimJanela = somarDias(hoje, JANELA_ESCALA_DIAS);
  const eventos = lista(dados.events);
  return eventos
    .filter((e) => e.startDate >= inicioJanela && e.startDate <= fimJanela && ctx.pro(e.professionalId))
    .map((e) => {
      const pro = ctx.pro(e.professionalId);
      const tipo = nomeTipo(e.type);
      // "Férias começam", "Folga começa".
      const [presente, passado] = e.type === 'ferias' ? ['começam', 'começaram'] : ['começa', 'começou'];
      const quandoComeca = e.startDate > hoje
        ? `${presente} em ${dataBR(e.startDate)}`
        : e.startDate === hoje ? `${presente} hoje` : `${passado} em ${dataBR(e.startDate)}`;
      const colegas = eventos
        .filter((o) => o.id !== e.id && o.startDate <= e.endDate && o.endDate >= e.startDate)
        .map((o) => ctx.pro(o.professionalId))
        .filter((o) => o && o.id !== pro.id && o.professionId === pro.professionId && o.shift === pro.shift)
        .map((o) => o.name);
      return {
        id: `escala-inicio:${e.id}`,
        categoria: 'escala',
        tipo: 'ausencia',
        data: e.startDate,
        quando: e.startDate > hoje ? somarDias(e.startDate, -JANELA_ESCALA_DIAS) : e.startDate,
        titulo: `${tipo} de ${pro.name} ${quandoComeca}`,
        resumo: `${periodoBR(e.startDate, e.endDate)} · ${diasEntre(e.startDate, e.endDate)} dia(s) · ${ctx.cargo(pro)} · ${nomeTurno(pro.shift)}`,
        professionalId: pro.id,
        detalhes: [
          { rotulo: 'Profissional', valor: pro.name },
          { rotulo: 'Tipo', valor: tipo },
          { rotulo: 'Período', valor: periodoBR(e.startDate, e.endDate) },
          { rotulo: 'Dias', valor: `${diasEntre(e.startDate, e.endDate)} dia(s)` },
          { rotulo: 'Volta ao trabalho', valor: dataBR(somarDias(e.endDate, 1)) },
          { rotulo: 'Cargo e turno', valor: `${ctx.cargo(pro)} · ${nomeTurno(pro.shift)}` },
          { rotulo: 'Mesmo cargo e turno fora no período', valor: colegas.length ? [...new Set(colegas)].join(', ') : 'ninguém' },
        ],
        orientacao: colegas.length
          ? 'Há outra ausência do mesmo cargo e turno no período: vale conferir a cobertura.'
          : 'Ninguém do mesmo cargo e turno está fora no período.',
        acao: { tipo: 'ver-escala', rotulo: 'Ver na escala' },
      };
    });
}

// Dias dos próximos 7 em que 2 ou mais pessoas do mesmo cargo e turno estão fora.
// Dias seguidos do mesmo grupo viram um alerta só.
function deCobertura(dados, hoje, ctx) {
  const eventos = lista(dados.events);
  const porGrupo = new Map();
  for (let i = 0; i <= JANELA_ESCALA_DIAS; i++) {
    const dia = somarDias(hoje, i);
    const fora = new Map();
    for (const e of eventos) {
      const pro = ctx.pro(e.professionalId);
      if (!pro || e.startDate > dia || e.endDate < dia) continue;
      const chave = `${pro.professionId || 'sem-cargo'}|${pro.shift || 'sem-turno'}`;
      if (!fora.has(chave)) fora.set(chave, new Map());
      fora.get(chave).set(pro.id, { pro, tipo: e.type });
    }
    for (const [chave, pessoas] of fora) {
      if (pessoas.size < 2) continue;
      if (!porGrupo.has(chave)) porGrupo.set(chave, []);
      porGrupo.get(chave).push({ dia, pessoas });
    }
  }

  const alertas = [];
  for (const [chave, dias] of porGrupo) {
    let sequencia = [];
    const fechar = () => {
      if (!sequencia.length) return;
      const inicio = sequencia[0].dia;
      const fim = sequencia[sequencia.length - 1].dia;
      const pessoas = new Map();
      for (const d of sequencia) for (const [id, v] of d.pessoas) pessoas.set(id, v);
      const exemplo = [...pessoas.values()][0].pro;
      const maximo = Math.max(...sequencia.map((d) => d.pessoas.size));
      alertas.push({
        id: `escala-cobertura:${chave}|${inicio}`,
        categoria: 'escala',
        tipo: 'cobertura',
        data: inicio,
        quando: inicio > hoje ? somarDias(inicio, -JANELA_ESCALA_DIAS) : inicio,
        titulo: `Cobertura: até ${maximo} de ${ctx.cargo(exemplo)} (${nomeTurno(exemplo.shift)}) fora ${inicio === fim ? `em ${dataBR(inicio)}` : `de ${dataBR(inicio)} a ${dataBR(fim)}`}`,
        resumo: [...pessoas.values()].map((v) => `${v.pro.name} (${nomeTipo(v.tipo).toLowerCase()})`).join(', '),
        detalhes: [
          { rotulo: 'Cargo e turno', valor: `${ctx.cargo(exemplo)} · ${nomeTurno(exemplo.shift)}` },
          { rotulo: 'Dias afetados', valor: periodoBR(inicio, fim) },
          { rotulo: 'Mais gente fora num mesmo dia', valor: `${maximo} pessoas` },
          { rotulo: 'Quem está fora', valor: [...pessoas.values()].map((v) => `${v.pro.name} — ${nomeTipo(v.tipo)}`).join('; ') },
        ],
        orientacao: 'Duas ou mais pessoas do mesmo cargo e turno fora ao mesmo tempo: confira se a escala cobre esses dias.',
        acao: { tipo: 'ver-escala', rotulo: 'Ver na escala' },
      });
      sequencia = [];
    };
    for (const d of dias) {
      if (sequencia.length && somarDias(sequencia[sequencia.length - 1].dia, 1) !== d.dia) fechar();
      sequencia.push(d);
    }
    fechar();
  }
  return alertas;
}

export function montarNotificacoes(dados, estado, hoje, novidades = []) {
  const ctx = contexto(dados);
  return [
    ...deSistema(novidades),
    ...deFeriasPendentes(dados, hoje, ctx),
    ...deHistorico(estado, hoje),
    ...deAusencias(dados, hoje, ctx),
    ...deCobertura(dados, hoje, ctx),
  ].sort((a, b) => b.quando.localeCompare(a.quando) || a.data.localeCompare(b.data));
}

// Registro do que o operador fez (ex.: férias lançadas), para os outros computadores verem.
export function registrarHistorico(estado, entradas) {
  const novas = entradas.filter((e) => !estado.historico.some((h) => h.id === e.id));
  return { historico: [...novas, ...estado.historico].slice(0, MAX_HISTORICO) };
}
