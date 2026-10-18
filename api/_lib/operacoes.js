// As escritas do sistema, uma por operação. Antes o navegador baixava o data.json inteiro,
// mexia e mandava de volta — um `{}` apagava tudo. Agora cada operação tem um schema
// `.strict()` (padrão 1.4) e o servidor aplica a mudança sobre o documento que acabou de ler.
//
// Os registros gravados têm exatamente o formato que as telas gravavam antes (mesmos campos,
// mesmos ids `evt_`, `log_`, `folga_`, `ferias_`, `p_`, `cargo_`), para o histórico do Gist
// continuar legível e o SAME continuar lendo igual.
//
// As regras de saldo e de conflito de período continuam no formulário, como avisos ao admin.
// Aqui fica o que protege a integridade: o que é referenciado existe, datas são datas,
// matrícula não se repete, cargo em uso não some, registro ligado a ausência não some.
import { z } from 'zod';
import { ErroPedido } from './http.js';
import { DIAS_POR_PERIODO, ehData, hojeISO, pendenciasDoProfissional, ultimoAniversario } from '../../shared/ferias.js';
import { estaBloqueado, ipDoPedido, limparConta, registrarErro } from './limitador.js';
import { conferirSenha, gerarHash } from './senha.js';

const MIN_SENHA_COLABORADOR = 6;
const MIN_SENHA_ADMIN = 8;

const ehDataReal = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const id = z.string().trim().min(1).max(64);
const texto = (max) => z.string().trim().max(max);
const obrigatorio = (max) => z.string().trim().min(1).max(max);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD').refine(ehDataReal, 'data inexistente');
const ano = z.string().regex(/^\d{4}$/, 'ano com 4 dígitos').refine((a) => +a >= 2000 && +a <= 2100, 'ano entre 2000 e 2100');
// O lote vem do `year` de um registro do banco e é gravado como veio: registro antigo pode
// ter o ano como número, e a tela compara com ===.
const anoLote = z.union([ano, z.number().int().min(2000).max(2100)]);
const dias = z.number().int().min(1).max(366);
const cor = z.string().regex(/^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/, 'cor inválida');
const senha = z.string().max(200);

const lista = (v) => (Array.isArray(v) ? v : []);
const hojeBR = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
const diasEntre = (inicio, fim) => Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000) + 1;
const dataBR = (iso) => iso.split('-').reverse().join('/');

function novoId(prefixo, existentes) {
  const usados = new Set(existentes.map((x) => x?.id));
  let n = Date.now();
  while (usados.has(`${prefixo}_${n}`)) n += 1;
  return `${prefixo}_${n}`;
}

function acharProfissional(dados, profissionalId) {
  const pro = lista(dados.professionals).find((p) => p.id === profissionalId);
  if (!pro) throw new ErroPedido(404, 'Profissional não encontrado.');
  return pro;
}

const trocarProfissional = (dados, novo) => ({
  ...dados,
  professionals: lista(dados.professionals).map((p) => (p.id === novo.id ? novo : p)),
});

const sessoesDoColaborador = (proId) => (s) => s.papel === 'colaborador' && s.usuario === proId;

// Data de admissão no cadastro (ver ferias.js). Na primeira vez que ela é registrada, a contagem
// começa no último aniversário que já passou, e o saldo que a pessoa já tem entra pelos lotes
// que o operador escolhe (`saldoInicialFerias`: ano de referência + dias). Depois disso, mudar
// a data só corrige a data; o saldo inicial não entra de novo.
function aplicarAdmissao(atual, v) {
  const saldo = v.saldoInicialFerias;
  if (v.dataAdmissao === undefined || v.dataAdmissao === '') {
    if (saldo.length) throw new ErroPedido(400, 'Informe a data de admissão para lançar o saldo inicial de férias.');
    if (v.dataAdmissao === undefined) return atual;
    const semAdmissao = { ...atual };
    delete semAdmissao.dataAdmissao;
    delete semAdmissao.feriasAniversarioAte;
    return semAdmissao;
  }

  const hoje = hojeISO();
  const limite = `${Number(hoje.slice(0, 4)) + 1}${hoje.slice(4)}`;
  if (v.dataAdmissao > limite) throw new ErroPedido(400, 'A data de admissão não pode passar de um ano à frente.');

  const novo = { ...atual, dataAdmissao: v.dataAdmissao };
  if (ehData(atual.dataAdmissao)) {
    if (saldo.length) throw new ErroPedido(400, 'O saldo inicial de férias só entra na primeira vez que a admissão é registrada. Use o Banco de Férias.');
    return novo;
  }

  const ultimo = ultimoAniversario(v.dataAdmissao, hoje);
  if (ultimo) novo.feriasAniversarioAte = ultimo;
  else delete novo.feriasAniversarioAte;
  if (saldo.length) {
    const banco = [...lista(atual.bancoFerias)];
    for (const lote of saldo) {
      banco.push({ id: novoId('ferias', banco), type: 'entrada', year: lote.year, category: 'Individual', days: lote.days, createdAt: hojeBR(), targetDate: null, origem: 'saldo-inicial' });
    }
    novo.bancoFerias = banco;
  }
  return novo;
}

// Cada operação: `esquema` (zod), `preparar` opcional (o que é assíncrono: hash, conferir
// senha) e `aplicar(dados, valores, contexto)`, que devolve { dados, encerrar? }.
// `encerrar` é um filtro de sessões a derrubar depois da gravação.
export const OPERACOES = {
  'evento.salvar': {
    esquema: z.object({
      id: id.optional(),
      professionalId: id,
      type: z.enum(['ferias', 'folga', 'atestado']),
      startDate: data,
      endDate: data,
      reason: texto(300).optional().default(''),
      loteYear: anoLote.nullable().optional(),
    }).strict()
      .refine((e) => e.startDate <= e.endDate, { message: 'a data final não pode ser antes da inicial', path: ['endDate'] })
      .refine((e) => e.type !== 'atestado' || e.reason.length > 0, { message: 'atestado exige o motivo', path: ['reason'] })
      .refine((e) => e.type !== 'ferias' || Boolean(e.loteYear), { message: 'férias exigem o lote (ano)', path: ['loteYear'] }),
    aplicar(dados, v) {
      const pro = acharProfissional(dados, v.professionalId);
      const eventos = lista(dados.events);
      let eventId = v.id;
      if (eventId) {
        const existente = eventos.find((e) => e.id === eventId);
        if (!existente) throw new ErroPedido(404, 'Ausência não encontrada.');
        if (existente.professionalId !== v.professionalId) {
          throw new ErroPedido(400, 'Não é possível trocar o profissional de uma ausência.');
        }
      } else {
        eventId = novoId('evt', eventos);
      }

      const evento = {
        id: eventId,
        professionalId: v.professionalId,
        type: v.type,
        reason: v.type === 'atestado' ? v.reason : '',
        startDate: v.startDate,
        endDate: v.endDate,
        loteYear: v.type === 'ferias' ? v.loteYear : null,
      };
      const novosEventos = v.id ? eventos.map((e) => (e.id === eventId ? evento : e)) : [...eventos, evento];

      // O desconto no banco tem o id `log_<evento>`. Ele sai dos dois bancos antes de entrar
      // no certo: editar uma férias para atestado (ou folga para férias) não deixa desconto
      // velho para trás — antes deixava.
      const logId = `log_${eventId}`;
      const semLog = (banco) => (Array.isArray(banco) ? banco.filter((l) => l.id !== logId) : banco);
      let folgas = semLog(pro.bancoFolgas);
      let ferias = semLog(pro.bancoFerias);
      const periodo = `${dataBR(v.startDate)} a ${dataBR(v.endDate)}`;
      const quantidade = diasEntre(v.startDate, v.endDate);
      if (v.type === 'folga') {
        folgas = [...lista(folgas), { id: logId, type: 'saida', days: quantidade, reason: `Uso no período: ${periodo}`, createdAt: hojeBR(), targetDate: periodo }];
      } else if (v.type === 'ferias') {
        ferias = [...lista(ferias), { id: logId, type: 'saida', year: v.loteYear, days: quantidade, createdAt: hojeBR(), targetDate: periodo }];
      }
      const novoPro = { ...pro };
      if (folgas !== undefined) novoPro.bancoFolgas = folgas;
      if (ferias !== undefined) novoPro.bancoFerias = ferias;

      return { dados: { ...trocarProfissional(dados, novoPro), events: novosEventos } };
    },
  },

  'evento.excluir': {
    esquema: z.object({ id }).strict(),
    aplicar(dados, v) {
      const eventos = lista(dados.events);
      if (!eventos.some((e) => String(e.id) === v.id)) throw new ErroPedido(404, 'Ausência não encontrada.');
      const logId = `log_${v.id}`;
      const semLog = (banco) => (Array.isArray(banco) ? banco.filter((l) => l.id !== logId) : banco);
      return {
        dados: {
          ...dados,
          events: eventos.filter((e) => String(e.id) !== v.id),
          professionals: lista(dados.professionals).map((p) => {
            const novo = { ...p };
            if (Array.isArray(p.bancoFolgas)) novo.bancoFolgas = semLog(p.bancoFolgas);
            if (Array.isArray(p.bancoFerias)) novo.bancoFerias = semLog(p.bancoFerias);
            return novo;
          }),
        },
      };
    },
  },

  'profissional.salvar': {
    esquema: z.object({
      id: id.optional(),
      name: obrigatorio(100),
      matricula: obrigatorio(40),
      matricula2: texto(40).optional().default(''),
      senha: senha.optional().default(''),
      baseColor: cor,
      professionId: id,
      shift: obrigatorio(40),
      isSupervisor: z.boolean(),
      dataAdmissao: z.union([data, z.literal('')]).optional(),
      saldoInicialFerias: z.array(z.object({ year: ano, days: dias }).strict()).max(6).optional().default([]),
    }).strict(),
    async preparar(v) {
      const nova = v.senha.trim();
      if (!v.id && !nova) throw new ErroPedido(400, 'A senha de acesso é obrigatória!');
      if (nova && nova.length < MIN_SENHA_COLABORADOR) {
        throw new ErroPedido(400, `A senha precisa de pelo menos ${MIN_SENHA_COLABORADOR} caracteres.`);
      }
      return { senhaHash: nova ? await gerarHash(nova) : null };
    },
    aplicar(dados, v, { senhaHash }) {
      const profissionais = lista(dados.professionals);
      if (!lista(dados.professions).some((c) => c.id === v.professionId)) {
        throw new ErroPedido(400, 'Cargo não encontrado. Selecione o cargo de novo.');
      }
      const repetida = profissionais.some((p) => p.matricula === v.matricula && p.id !== v.id);
      if (repetida) {
        throw new ErroPedido(409, v.id
          ? 'Esta matrícula principal já está sendo usada por outro funcionário!'
          : 'Erro: Já existe um funcionário com esta matrícula principal!');
      }
      const campos = {
        name: v.name,
        matricula: v.matricula,
        matricula2: v.matricula2,
        baseColor: v.baseColor,
        professionId: v.professionId,
        shift: v.shift,
        isSupervisor: v.isSupervisor,
      };

      if (!v.id) {
        const novo = aplicarAdmissao({ id: novoId('p', profissionais), ...campos, senhaHash }, v);
        return { dados: { ...dados, professionals: [...profissionais, novo] } };
      }

      const atual = acharProfissional(dados, v.id);
      const editado = aplicarAdmissao({ ...atual, ...campos }, v);
      if (senhaHash) {
        editado.senhaHash = senhaHash;
        // Senha em claro de antes da migração só some quando há hash no lugar.
        delete editado.password;
      }
      return {
        dados: trocarProfissional(dados, editado),
        encerrar: senhaHash ? sessoesDoColaborador(v.id) : undefined,
      };
    },
  },

  // A cada 12 meses da admissão, o operador decide: lança os dias (no ano que escolher) ou
  // dispensa, quando já lançou à mão. Os aniversários são resolvidos em ordem, do mais antigo
  // ao mais novo, e quem resolve avança `feriasAniversarioAte` — dois cliques no mesmo
  // aniversário não viram dois lançamentos.
  'ferias.aniversario.resolver': {
    esquema: z.object({
      professionalId: id,
      aniversario: data,
      acao: z.enum(['lancar', 'dispensar']),
      year: ano.optional(),
      days: dias.optional(),
    }).strict()
      .refine((v) => v.acao !== 'lancar' || Boolean(v.year), { message: 'informe o ano de referência', path: ['year'] }),
    aplicar(dados, v) {
      const pro = acharProfissional(dados, v.professionalId);
      const pendentes = pendenciasDoProfissional(pro, hojeISO());
      if (!pendentes.length) throw new ErroPedido(409, 'Não há férias a lançar para este profissional.');
      const proxima = pendentes[0];
      if (proxima.aniversario !== v.aniversario) {
        throw new ErroPedido(409, `Resolva antes o período que fechou em ${dataBR(proxima.aniversario)}.`);
      }
      if (v.acao === 'lancar' && Number(v.year) > Number(v.aniversario.slice(0, 4))) {
        throw new ErroPedido(400, 'O ano de referência não pode ser depois do ano em que o período fechou.');
      }

      const novo = { ...pro, feriasAniversarioAte: v.aniversario };
      const periodo = `${dataBR(proxima.periodo.inicio)} a ${dataBR(proxima.periodo.fim)}`;
      // Para a central de notificações: guarda o nome do momento, não só o id (regra C12).
      const registro = {
        id: `${v.acao === 'lancar' ? 'ferias-lancada' : 'ferias-dispensada'}:${pro.id}:${v.aniversario}`,
        tipo: v.acao === 'lancar' ? 'ferias-lancada' : 'ferias-dispensada',
        categoria: 'ferias',
        criadaEm: new Date().toISOString(),
        professionalId: pro.id,
        nome: pro.name,
        aniversario: v.aniversario,
        rotulo: proxima.periodo.rotulo,
        periodo,
        ...(v.acao === 'lancar' ? { year: v.year, days: v.days ?? DIAS_POR_PERIODO } : {}),
      };
      if (v.acao === 'lancar') {
        const banco = lista(pro.bancoFerias);
        novo.bancoFerias = [...banco, {
          id: novoId('ferias', banco),
          type: 'entrada',
          year: v.year,
          category: 'Individual',
          days: v.days ?? DIAS_POR_PERIODO,
          createdAt: hojeBR(),
          targetDate: null,
          origem: 'aniversario',
          aniversario: v.aniversario,
          periodo,
        }];
      }
      return { dados: trocarProfissional(dados, novo), notificar: [registro] };
    },
  },

  'profissional.excluir': {
    esquema: z.object({ id }).strict(),
    aplicar(dados, v) {
      acharProfissional(dados, v.id);
      return {
        dados: {
          ...dados,
          professionals: lista(dados.professionals).filter((p) => p.id !== v.id),
          events: lista(dados.events).filter((e) => e.professionalId !== v.id),
        },
        encerrar: sessoesDoColaborador(v.id),
      };
    },
  },

  'cargo.criar': {
    esquema: z.object({ name: obrigatorio(80) }).strict(),
    aplicar(dados, v) {
      const cargos = lista(dados.professions);
      return { dados: { ...dados, professions: [...cargos, { id: novoId('cargo', cargos), name: v.name }] } };
    },
  },

  'cargo.excluir': {
    esquema: z.object({ id }).strict(),
    aplicar(dados, v) {
      const cargo = lista(dados.professions).find((c) => c.id === v.id);
      if (!cargo) throw new ErroPedido(404, 'Cargo não encontrado.');
      const vinculados = lista(dados.professionals).filter((p) => p.professionId === v.id).length;
      if (vinculados > 0) {
        throw new ErroPedido(409, `ATENÇÃO: Você não pode excluir o cargo "${cargo.name}" pois existem ${vinculados} funcionário(s) vinculados a ele. Altere o cargo deles primeiro.`);
      }
      return { dados: { ...dados, professions: lista(dados.professions).filter((c) => c.id !== v.id) } };
    },
  },

  'banco.folga.adicionar': {
    esquema: z.object({ professionalId: id, days: dias, reason: obrigatorio(200) }).strict(),
    aplicar(dados, v) {
      const pro = acharProfissional(dados, v.professionalId);
      const registro = { id: novoId('folga', lista(pro.bancoFolgas)), type: 'entrada', days: v.days, reason: v.reason, createdAt: hojeBR(), targetDate: null };
      return { dados: trocarProfissional(dados, { ...pro, bancoFolgas: [...lista(pro.bancoFolgas), registro] }) };
    },
  },

  'banco.ferias.adicionar': {
    esquema: z.object({ professionalId: id, year: ano, category: obrigatorio(40), days: dias }).strict(),
    aplicar(dados, v) {
      const pro = acharProfissional(dados, v.professionalId);
      const registro = { id: novoId('ferias', lista(pro.bancoFerias)), type: 'entrada', year: v.year, category: v.category, days: v.days, createdAt: hojeBR(), targetDate: null };
      return { dados: trocarProfissional(dados, { ...pro, bancoFerias: [...lista(pro.bancoFerias), registro] }) };
    },
  },

  'banco.registro.excluir': {
    esquema: z.object({ professionalId: id, banco: z.enum(['folgas', 'ferias']), id }).strict(),
    aplicar(dados, v) {
      const pro = acharProfissional(dados, v.professionalId);
      const chave = v.banco === 'folgas' ? 'bancoFolgas' : 'bancoFerias';
      const registro = lista(pro[chave]).find((l) => l.id === v.id);
      if (!registro) throw new ErroPedido(404, 'Registro não encontrado.');
      if (registro.type === 'saida' && lista(dados.events).some((e) => e.id === v.id.replace('log_', ''))) {
        throw new ErroPedido(409, 'Este registro está vinculado a uma ausência no calendário. Exclua a ausência por lá.');
      }
      return { dados: trocarProfissional(dados, { ...pro, [chave]: pro[chave].filter((l) => l.id !== v.id) }) };
    },
  },

  // Mexer na credencial do admin pede a senha atual: uma sessão roubada não tranca o dono
  // para fora. É conferência de senha fora do login, então passa pelo limitador (regra A2).
  'admin.perfil': {
    esquema: z.object({
      username: obrigatorio(60),
      senhaAtual: senha.min(1),
      novaSenha: senha.optional().default(''),
    }).strict(),
    async preparar(v, { req, leitura }) {
      const chaves = [`ip:${ipDoPedido(req)}`, 'conta:admin-perfil'];
      if (estaBloqueado(chaves)) throw new ErroPedido(429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
      if (!(await conferirSenha(v.senhaAtual, leitura.dados.auth?.senhaHash))) {
        registrarErro(chaves);
        throw new ErroPedido(403, 'Senha atual incorreta.');
      }
      limparConta('conta:admin-perfil');
      const nova = v.novaSenha.trim();
      if (nova && nova.length < MIN_SENHA_ADMIN) {
        throw new ErroPedido(400, `A nova senha precisa de pelo menos ${MIN_SENHA_ADMIN} caracteres.`);
      }
      return { senhaHash: nova ? await gerarHash(nova) : null };
    },
    aplicar(dados, v, { senhaHash }, { sessao }) {
      const auth = { ...dados.auth, username: v.username };
      if (senhaHash) {
        auth.senhaHash = senhaHash;
        delete auth.password;
      }
      return {
        dados: { ...dados, auth },
        // Troca de senha derruba as outras sessões do admin; a de quem trocou continua.
        encerrar: senhaHash ? (s) => s.papel === 'admin' && s.hash !== sessao.hash : undefined,
      };
    },
  },
};
