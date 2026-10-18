// O que cada papel recebe do GET /api/dados. Sempre uma lista de campos, nunca "tudo menos
// a senha" (padrão 1.5): campo novo no cadastro não vaza por esquecimento.
import { hojeISO, pendenciasFerias } from '../../shared/ferias.js';
import { ehHashScrypt } from './senha.js';

const lista = (v) => (Array.isArray(v) ? v : []);
const escolher = (obj, campos) =>
  Object.fromEntries(campos.filter((c) => obj?.[c] !== undefined).map((c) => [c, obj[c]]));

const PROFISSIONAL_ADMIN = ['id', 'name', 'matricula', 'matricula2', 'baseColor', 'professionId', 'shift', 'isSupervisor', 'bancoFolgas', 'bancoFerias', 'dataAdmissao', 'feriasAniversarioAte'];
const PROFISSIONAL_EQUIPE = ['id', 'name', 'baseColor', 'professionId', 'shift'];
const EVENTO_ADMIN = ['id', 'professionalId', 'type', 'reason', 'startDate', 'endDate', 'loteYear'];
const EVENTO_EQUIPE = ['id', 'professionalId', 'type', 'startDate', 'endDate'];
const CARGO = ['id', 'name'];

export function visaoAdmin(dados) {
  return {
    perfil: { papel: 'admin', username: dados.auth?.username || 'Administrador' },
    professionals: lista(dados.professionals).map((p) => ({
      ...escolher(p, PROFISSIONAL_ADMIN),
      temSenha: ehHashScrypt(p.senhaHash),
    })),
    events: lista(dados.events).map((e) => escolher(e, EVENTO_ADMIN)),
    professions: lista(dados.professions).map((c) => escolher(c, CARGO)),
    // Aniversários de admissão que já passaram e o operador ainda não resolveu (ver ferias.js).
    pendenciasFerias: pendenciasFerias(dados.professionals, hojeISO()),
  };
}

// Colaborador vê só a própria escala; supervisor vê a da equipe. Nenhum dos dois recebe
// matrícula, banco de folgas/férias nem o motivo de atestado — dado de saúde (LGPD art. 11).
// O motivo de folga continua indo, porque o portal mostra.
export function visaoColaborador(dados, sessao) {
  const eu = sessao.profissional;
  const profissionais = sessao.supervisor ? lista(dados.professionals) : [eu];
  const eventos = lista(dados.events).filter((e) => sessao.supervisor || e.professionalId === eu.id);
  return {
    perfil: { papel: 'colaborador', ...escolher(eu, PROFISSIONAL_EQUIPE), isSupervisor: sessao.supervisor },
    professionals: profissionais.map((p) => escolher(p, PROFISSIONAL_EQUIPE)),
    events: eventos.map((e) => ({
      ...escolher(e, EVENTO_EQUIPE),
      ...(e.type === 'folga' && e.reason ? { reason: e.reason } : {}),
    })),
    professions: lista(dados.professions).map((c) => escolher(c, CARGO)),
  };
}
