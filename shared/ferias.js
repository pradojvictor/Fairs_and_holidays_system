// Férias por tempo de serviço: a cada 12 meses contados da data de admissão, a pessoa ganha
// 30 dias. O sistema NUNCA lança sozinho — ele lista as pendências e o operador confirma,
// escolhendo o ano de referência. A sugestão é o ano que terminou: quem completa mais 12 meses
// em 23/02/2027 ganha as férias referentes a 2026.
//
// Cada profissional guarda:
// - dataAdmissao: AAAA-MM-DD;
// - feriasAniversarioAte: o último aniversário de admissão já resolvido (lançado ou dispensado).
//   No primeiro registro da admissão ele vira o último aniversário que já passou — o saldo até
//   ali o operador lança à mão, escolhendo os anos —, e a contagem segue dali em diante.
//
// Puro, sem nada do Node: a tela importa daqui o mesmo cálculo que o servidor usa.

export const DIAS_POR_PERIODO = 30;

const pad = (n) => String(n).padStart(2, '0');

export function ehData(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

// Data de hoje no fuso da operação (Teresina), em AAAA-MM-DD.
export function hojeISO(agora = new Date()) {
  return agora.toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' });
}

export const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

// Aniversário da admissão no ano dado. Quem entrou em 29/02 faz aniversário em 28/02 nos
// anos sem 29.
export function aniversarioNoAno(dataAdmissao, ano) {
  const [, mes, dia] = dataAdmissao.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${pad(mes)}-${pad(Math.min(dia, ultimoDia))}`;
}

// Aniversários (12, 24, 36… meses depois da admissão) depois de `depoisDe` e até `ate`, inclusive.
export function aniversariosEntre(dataAdmissao, depoisDe, ate) {
  const lista = [];
  for (let ano = Number(dataAdmissao.slice(0, 4)) + 1; ano <= Number(ate.slice(0, 4)); ano++) {
    const aniversario = aniversarioNoAno(dataAdmissao, ano);
    if (aniversario > depoisDe && aniversario <= ate) lista.push(aniversario);
  }
  return lista;
}

export function ultimoAniversario(dataAdmissao, hoje) {
  const lista = aniversariosEntre(dataAdmissao, dataAdmissao, hoje);
  return lista.length ? lista[lista.length - 1] : null;
}

export function proximoAniversario(dataAdmissao, depoisDe) {
  const base = depoisDe > dataAdmissao ? depoisDe : dataAdmissao;
  for (let ano = Number(dataAdmissao.slice(0, 4)) + 1; ; ano++) {
    const aniversario = aniversarioNoAno(dataAdmissao, ano);
    if (aniversario > base) return aniversario;
  }
}

// O período aquisitivo que fecha no aniversário: os 12 meses anteriores a ele.
export function periodoAquisitivo(dataAdmissao, aniversario) {
  const inicio = aniversarioNoAno(dataAdmissao, Number(aniversario.slice(0, 4)) - 1);
  const fim = new Date(Date.parse(`${aniversario}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return { inicio, fim, rotulo: `${inicio.slice(2, 4)}-${fim.slice(2, 4)}` };
}

// Ano sugerido para o período que fecha no aniversário: o ano que passou.
export const anoSugerido = (aniversario) => String(Number(aniversario.slice(0, 4)) - 1);

// O que falta o operador decidir para um profissional, do mais antigo ao mais novo.
export function pendenciasDoProfissional(profissional, hoje) {
  if (!ehData(profissional?.dataAdmissao)) return [];
  const desde = ehData(profissional.feriasAniversarioAte) ? profissional.feriasAniversarioAte : profissional.dataAdmissao;
  return aniversariosEntre(profissional.dataAdmissao, desde, hoje).map((aniversario) => ({
    professionalId: profissional.id,
    aniversario,
    periodo: periodoAquisitivo(profissional.dataAdmissao, aniversario),
    anoSugerido: anoSugerido(aniversario),
    dias: DIAS_POR_PERIODO,
  }));
}

export function pendenciasFerias(profissionais, hoje) {
  return (Array.isArray(profissionais) ? profissionais : [])
    .flatMap((p) => pendenciasDoProfissional(p, hoje))
    .sort((a, b) => a.aniversario.localeCompare(b.aniversario));
}
