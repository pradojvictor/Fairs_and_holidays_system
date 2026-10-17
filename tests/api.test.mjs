// Testes da API contra um GitHub falso, em memória: nenhum teste chega perto do Gist real.
// O `fetch` global é trocado antes de carregar a API, e o Gist falso recusa qualquer outro id.
//   yarn test
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

process.env.GITHUB_GIST_ID = 'gist-de-teste';
process.env.GITHUB_TOKEN = 'token-de-teste';
process.env.GITHUB_FILENAME = 'data.json';
process.env.VERCEL = '1';
delete process.env.COOKIE_SEGURO;

// ---------- GitHub falso ----------
const gist = { files: {}, leituras: 0, gravacoes: 0, fora: false, aoLer: null };

const json = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (url, opcoes = {}) => {
  if (gist.fora) throw new TypeError('fetch failed: ECONNREFUSED');
  assert.equal(url, 'https://api.github.com/gists/gist-de-teste', 'a API só pode falar com o Gist configurado');
  if ((opcoes.method || 'GET') === 'GET') {
    gist.leituras += 1;
    if (gist.aoLer) gist.aoLer(gist.leituras);
    const files = Object.fromEntries(Object.entries(gist.files).map(([nome, content]) => [nome, { filename: nome, content, truncated: false }]));
    return json(200, { files });
  }
  if (opcoes.method === 'PATCH') {
    gist.gravacoes += 1;
    for (const [nome, arquivo] of Object.entries(JSON.parse(opcoes.body).files)) gist.files[nome] = arquivo.content;
    return json(200, {});
  }
  return json(405, {});
};

const { gerarHash, conferirSenha, ehHashScrypt } = await import('../api/_lib/senha.js');
const rotaLogin = (await import('../api/login.js')).default;
const rotaLogout = (await import('../api/logout.js')).default;
const rotaDados = (await import('../api/dados.js')).default;
const rotaOperacao = (await import('../api/operacao.js')).default;
const { planejarMigracao } = await import('../scripts/migrar-senhas.mjs');

// ---------- dados de exemplo ----------
const HASHES = {
  admin: await gerarHash('senha-do-admin'),
  ana: await gerarHash('ana123'),
  bruno: await gerarHash('bruno123'),
  davi: await gerarHash('davi123'),
};

const BASE = {
  auth: { username: 'admin', senhaHash: HASHES.admin },
  professionals: [
    {
      id: 'p_1', name: 'Ana Souza', matricula: '100', matricula2: '', senhaHash: HASHES.ana, baseColor: '#F44336',
      professionId: 'cargo_1', shift: 'manhã', isSupervisor: false,
      bancoFolgas: [{ id: 'folga_1', type: 'entrada', days: 3, reason: 'Plantão extra', createdAt: '01/10/2026', targetDate: null }],
      bancoFerias: [{ id: 'ferias_1', type: 'entrada', year: '2026', category: 'Individual', days: 30, createdAt: '01/10/2026', targetDate: null }],
    },
    { id: 'p_2', name: 'Bruno Lima', matricula: '200', matricula2: '', senhaHash: HASHES.bruno, baseColor: '#2196F3', professionId: 'cargo_1', shift: 'tarde', isSupervisor: true },
    // Cadastro de antes da migração: senha em texto puro.
    { id: 'p_3', name: 'Carla Dias', matricula: '300', matricula2: '', password: 'texto-puro', baseColor: '#4CAF50', professionId: 'cargo_2', shift: 'dia_todo', isSupervisor: false },
    { id: 'p_4', name: 'Davi Reis', matricula: '400', matricula2: '', senhaHash: HASHES.davi, baseColor: '#795548', professionId: 'cargo_2', shift: 'dia_todo', isSupervisor: false },
  ],
  events: [
    { id: 'evt_1', professionalId: 'p_1', type: 'atestado', reason: 'CID F32', startDate: '2026-10-01', endDate: '2026-10-02', loteYear: null },
    { id: 'evt_2', professionalId: 'p_2', type: 'folga', reason: 'Consulta marcada', startDate: '2026-10-05', endDate: '2026-10-05', loteYear: null },
    { id: 'evt_3', professionalId: 'p_3', type: 'ferias', reason: '', startDate: '2026-11-01', endDate: '2026-11-10', loteYear: '2026' },
  ],
  professions: [{ id: 'cargo_1', name: 'Enfermagem' }, { id: 'cargo_2', name: 'Recepção' }],
  campoQueOSistemaNaoConhece: { manter: true },
};

const lerDados = () => JSON.parse(gist.files['data.json']);
const lerSessoes = () => (gist.files['sessoes.json'] ? JSON.parse(gist.files['sessoes.json']).sessoes : []);

beforeEach(() => {
  gist.files = { 'data.json': JSON.stringify(BASE, null, 2) };
  gist.leituras = 0;
  gist.gravacoes = 0;
  gist.fora = false;
  gist.aoLer = null;
});

// ---------- pedido e resposta no formato da Vercel ----------
let ultimoIp = 0;
function pedido(method, { body, cookie, ip, origin, contentType = 'application/json' } = {}) {
  return {
    method,
    body,
    headers: {
      host: 'ferias.test',
      'x-real-ip': ip || `10.0.${Math.floor(++ultimoIp / 250)}.${ultimoIp % 250}`,
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
      ...(method !== 'GET' ? { 'content-type': contentType } : {}),
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function chamar(rota, method, opcoes) {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = () => res;
  await rota(pedido(method, opcoes), res);
  return res;
}

async function entrar(credenciais, ip) {
  const res = await chamar(rotaLogin, 'POST', { body: credenciais, ip });
  assert.equal(res.statusCode, 200, `login deveria entrar: ${JSON.stringify(res.body)}`);
  return res.headers['set-cookie'].split(';')[0];
}
const entrarAdmin = () => entrar({ tipo: 'admin', usuario: 'admin', senha: 'senha-do-admin' });
const operar = (cookie, op, dados) => chamar(rotaOperacao, 'POST', { cookie, body: { op, dados } });

// ---------- sem sessão, nada ----------
test('GET /api/dados sem sessão: 401, e nem chega a ler o Gist', async () => {
  const res = await chamar(rotaDados, 'GET');
  assert.equal(res.statusCode, 401);
  assert.equal(gist.leituras, 0);
  assert.doesNotMatch(JSON.stringify(res.body), /CID|senha|scrypt/);
});

test('cookie inventado: 401', async () => {
  const res = await chamar(rotaDados, 'GET', { cookie: `__Host-sessao=${'A'.repeat(43)}` });
  assert.equal(res.statusCode, 401);
});

test('PATCH /api/dados não existe mais: 405, e o Gist fica intacto', async () => {
  const antes = gist.files['data.json'];
  const res = await chamar(rotaDados, 'PATCH', { body: {} });
  assert.equal(res.statusCode, 405);
  assert.equal(gist.files['data.json'], antes);
  assert.equal(gist.gravacoes, 0);
});

test('POST /api/operacao sem sessão: 401, nada gravado', async () => {
  const res = await chamar(rotaOperacao, 'POST', { body: { op: 'evento.excluir', dados: { id: 'evt_1' } } });
  assert.equal(res.statusCode, 401);
  assert.equal(gist.gravacoes, 0);
});

// ---------- login ----------
test('login do admin: cookie HttpOnly + Secure + SameSite=Strict, e o Gist guarda só o hash', async () => {
  const res = await chamar(rotaLogin, 'POST', { body: { tipo: 'admin', usuario: 'admin', senha: 'senha-do-admin' } });
  assert.equal(res.statusCode, 200);
  const cookie = res.headers['set-cookie'];
  assert.match(cookie, /^__Host-sessao=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Strict; Secure$/);
  const token = cookie.split(';')[0].split('=')[1];
  const sessoes = lerSessoes();
  assert.equal(sessoes.length, 1);
  assert.equal(sessoes[0].papel, 'admin');
  assert.doesNotMatch(gist.files['sessoes.json'], new RegExp(token), 'o token não pode estar no Gist');
  assert.equal(gist.files['data.json'], JSON.stringify(BASE, null, 2), 'login não toca o data.json');
});

test('senha errada e conta inexistente: a mesma resposta', async () => {
  const errada = await chamar(rotaLogin, 'POST', { body: { tipo: 'colaborador', matricula: '100', senha: 'nao-e-essa' } });
  const inexistente = await chamar(rotaLogin, 'POST', { body: { tipo: 'colaborador', matricula: '987654', senha: 'qualquer' } });
  assert.equal(errada.statusCode, 401);
  assert.deepEqual(errada.body, inexistente.body);
  assert.equal(inexistente.statusCode, 401);
});

test('senha em texto puro no cadastro não entra: não há ramo de compatibilidade', async () => {
  const res = await chamar(rotaLogin, 'POST', { body: { tipo: 'colaborador', matricula: '300', senha: 'texto-puro' } });
  assert.equal(res.statusCode, 401);
});

test('limite: 5 erros na mesma conta dão 429, inclusive com a senha certa depois — exista a conta ou não', async () => {
  for (const [matricula, ip, senhaCerta] of [['400', '10.200.0.1', 'davi123'], ['555555', '10.200.0.2', 'qualquer']]) {
    for (let i = 0; i < 5; i++) {
      const r = await chamar(rotaLogin, 'POST', { ip, body: { tipo: 'colaborador', matricula, senha: `errada${i}` } });
      assert.equal(r.statusCode, 401);
    }
    const bloqueado = await chamar(rotaLogin, 'POST', { ip: '10.200.0.3', body: { tipo: 'colaborador', matricula, senha: senhaCerta } });
    assert.equal(bloqueado.statusCode, 429, `matrícula ${matricula}`);
  }
});

test('pedido de outra origem é recusado', async () => {
  const res = await chamar(rotaLogin, 'POST', { origin: 'https://site-malicioso.example', body: { tipo: 'admin', usuario: 'admin', senha: 'senha-do-admin' } });
  assert.equal(res.statusCode, 403);
});

test('pedido que não é JSON é recusado', async () => {
  const res = await chamar(rotaLogin, 'POST', { contentType: 'application/x-www-form-urlencoded', body: 'tipo=admin' });
  assert.equal(res.statusCode, 415);
});

// ---------- o que cada papel vê ----------
test('admin vê tudo, menos credenciais', async () => {
  const res = await chamar(rotaDados, 'GET', { cookie: await entrarAdmin() });
  assert.equal(res.statusCode, 200);
  const texto = JSON.stringify(res.body);
  assert.doesNotMatch(texto, /senhaHash|password|scrypt\$|texto-puro|"auth"/);
  assert.match(texto, /CID F32/);
  assert.equal(res.body.perfil.papel, 'admin');
  assert.deepEqual(res.body.professionals.map((p) => p.temSenha), [true, true, false, true]);
  assert.equal(res.body.professionals[0].bancoFerias.length, 1);
});

test('colaborador vê só a própria escala, sem o motivo do atestado', async () => {
  const cookie = await entrar({ tipo: 'colaborador', matricula: '100', senha: 'ana123' });
  const { body } = await chamar(rotaDados, 'GET', { cookie });
  assert.equal(body.perfil.id, 'p_1');
  assert.equal(body.perfil.isSupervisor, false);
  assert.deepEqual(body.professionals.map((p) => p.id), ['p_1']);
  assert.deepEqual(body.events.map((e) => e.id), ['evt_1']);
  const texto = JSON.stringify(body);
  assert.doesNotMatch(texto, /CID|matricula|banco|senha|password|Bruno|Carla/);
});

test('supervisor vê a equipe, sem CID, matrícula ou banco', async () => {
  const cookie = await entrar({ tipo: 'colaborador', matricula: '200', senha: 'bruno123' });
  const { body } = await chamar(rotaDados, 'GET', { cookie });
  assert.equal(body.perfil.isSupervisor, true);
  assert.equal(body.events.length, 3);
  assert.equal(body.events.find((e) => e.id === 'evt_1').reason, undefined);
  assert.equal(body.events.find((e) => e.id === 'evt_2').reason, 'Consulta marcada');
  assert.doesNotMatch(JSON.stringify(body), /CID|matricula|banco|senha|password/);
});

test('colaborador não escreve: 403', async () => {
  const cookie = await entrar({ tipo: 'colaborador', matricula: '200', senha: 'bruno123' });
  const res = await operar(cookie, 'evento.excluir', { id: 'evt_1' });
  assert.equal(res.statusCode, 403);
  assert.equal(lerDados().events.length, 3);
});

test('supervisor rebaixado perde a visão da equipe no próximo pedido', async () => {
  const cookieBruno = await entrar({ tipo: 'colaborador', matricula: '200', senha: 'bruno123' });
  const admin = await entrarAdmin();
  const res = await operar(admin, 'profissional.salvar', {
    id: 'p_2', name: 'Bruno Lima', matricula: '200', matricula2: '', senha: '', baseColor: '#2196F3', professionId: 'cargo_1', shift: 'tarde', isSupervisor: false,
  });
  assert.equal(res.statusCode, 200);
  const { body } = await chamar(rotaDados, 'GET', { cookie: cookieBruno });
  assert.deepEqual(body.events.map((e) => e.id), ['evt_2']);
});

// ---------- escrita validada ----------
test('corpo inválido: 400 e nada gravado', async () => {
  const cookie = await entrarAdmin();
  const gravacoesAntes = gist.gravacoes;
  const casos = [
    {},
    { op: 'apagarTudo', dados: {} },
    { op: 'evento.excluir' },
    { op: 'evento.salvar', dados: { professionalId: 'p_1', type: 'folga', startDate: '2026-12-01', endDate: '2026-12-01', isAdmin: true } },
    { op: 'evento.salvar', dados: { professionalId: 'p_1', type: 'folga', startDate: '2026-02-30', endDate: '2026-03-01' } },
    { op: 'evento.salvar', dados: { professionalId: 'p_1', type: 'folga', startDate: '2026-12-05', endDate: '2026-12-01' } },
    { op: 'evento.salvar', dados: { professionalId: 'p_1', type: 'atestado', startDate: '2026-12-01', endDate: '2026-12-01', reason: '' } },
    { op: 'banco.folga.adicionar', dados: { professionalId: 'p_1', days: -2, reason: 'x' } },
  ];
  for (const body of casos) {
    const res = await chamar(rotaOperacao, 'POST', { cookie, body });
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
  assert.equal(gist.gravacoes, gravacoesAntes);
  assert.equal(gist.files['data.json'], JSON.stringify(BASE, null, 2));
});

test('evento.salvar grava a ausência e o desconto; evento.excluir tira os dois; o resto do arquivo sobrevive', async () => {
  const cookie = await entrarAdmin();
  const criar = await operar(cookie, 'evento.salvar', { professionalId: 'p_1', type: 'folga', startDate: '2026-12-01', endDate: '2026-12-02', reason: '', loteYear: null });
  assert.equal(criar.statusCode, 200);
  let dados = lerDados();
  const evento = dados.events.at(-1);
  assert.deepEqual(Object.keys(evento), ['id', 'professionalId', 'type', 'reason', 'startDate', 'endDate', 'loteYear']);
  const log = dados.professionals[0].bancoFolgas.at(-1);
  assert.equal(log.id, `log_${evento.id}`);
  assert.equal(log.days, 2);
  assert.equal(log.targetDate, '01/12/2026 a 02/12/2026');
  assert.deepEqual(dados.campoQueOSistemaNaoConhece, { manter: true });
  assert.equal(dados.professionals[2].password, 'texto-puro', 'cadastro não migrado não perde a senha antiga');

  const excluir = await operar(cookie, 'evento.excluir', { id: evento.id });
  assert.equal(excluir.statusCode, 200);
  dados = lerDados();
  assert.equal(dados.events.length, 3);
  assert.equal(dados.professionals[0].bancoFolgas.length, 1);
  assert.deepEqual(dados, BASE);
});

test('editar férias para atestado não deixa o desconto velho no banco', async () => {
  const cookie = await entrarAdmin();
  await operar(cookie, 'evento.salvar', { professionalId: 'p_1', type: 'ferias', startDate: '2026-12-10', endDate: '2026-12-14', reason: '', loteYear: '2026' });
  const id = lerDados().events.at(-1).id;
  assert.equal(lerDados().professionals[0].bancoFerias.at(-1).id, `log_${id}`);
  const res = await operar(cookie, 'evento.salvar', { id, professionalId: 'p_1', type: 'atestado', startDate: '2026-12-10', endDate: '2026-12-14', reason: 'Atestado médico', loteYear: null });
  assert.equal(res.statusCode, 200);
  assert.equal(lerDados().professionals[0].bancoFerias.some((l) => l.id === `log_${id}`), false);
});

test('regras de integridade: matrícula repetida, cargo em uso, registro ligado a ausência', async () => {
  const cookie = await entrarAdmin();
  const repetida = await operar(cookie, 'profissional.salvar', { name: 'Outra', matricula: '100', senha: 'abcdef', baseColor: '#000000', professionId: 'cargo_1', shift: 'manhã', isSupervisor: false });
  assert.equal(repetida.statusCode, 409);
  const semSenha = await operar(cookie, 'profissional.salvar', { name: 'Outra', matricula: '999', senha: '', baseColor: '#000000', professionId: 'cargo_1', shift: 'manhã', isSupervisor: false });
  assert.equal(semSenha.statusCode, 400);
  const cargo = await operar(cookie, 'cargo.excluir', { id: 'cargo_1' });
  assert.equal(cargo.statusCode, 409);
  await operar(cookie, 'evento.salvar', { professionalId: 'p_1', type: 'folga', startDate: '2026-12-20', endDate: '2026-12-20', reason: '', loteYear: null });
  const id = lerDados().events.at(-1).id;
  const registro = await operar(cookie, 'banco.registro.excluir', { professionalId: 'p_1', banco: 'folgas', id: `log_${id}` });
  assert.equal(registro.statusCode, 409);
});

test('novo profissional: a senha vira hash; ninguém lê a senha de volta', async () => {
  const cookie = await entrarAdmin();
  const res = await operar(cookie, 'profissional.salvar', { name: 'Elisa Melo', matricula: '500', matricula2: '', senha: 'elisa123', baseColor: '#000000', professionId: 'cargo_2', shift: 'manhã', isSupervisor: false });
  assert.equal(res.statusCode, 200);
  const elisa = lerDados().professionals.at(-1);
  assert.equal(elisa.password, undefined);
  assert.ok(ehHashScrypt(elisa.senhaHash));
  assert.ok(await conferirSenha('elisa123', elisa.senhaHash));
  await entrar({ tipo: 'colaborador', matricula: '500', senha: 'elisa123' });
});

// ---------- revogação ----------
test('logout derruba a sessão no servidor, não só no navegador', async () => {
  const cookie = await entrarAdmin();
  const sair = await chamar(rotaLogout, 'POST', { cookie, body: {} });
  assert.equal(sair.statusCode, 204);
  assert.match(sair.headers['set-cookie'], /Max-Age=0/);
  assert.equal(lerSessoes().length, 0);
  const depois = await chamar(rotaDados, 'GET', { cookie });
  assert.equal(depois.statusCode, 401);
});

test('profissional excluído perde a sessão na hora', async () => {
  const cookieAna = await entrar({ tipo: 'colaborador', matricula: '100', senha: 'ana123' });
  const admin = await entrarAdmin();
  assert.equal((await operar(admin, 'profissional.excluir', { id: 'p_1' })).statusCode, 200);
  assert.equal((await chamar(rotaDados, 'GET', { cookie: cookieAna })).statusCode, 401);
  assert.equal(lerSessoes().some((s) => s.usuario === 'p_1'), false);
});

test('trocar a senha do colaborador derruba as sessões dele; a nova senha vale', async () => {
  const cookieAna = await entrar({ tipo: 'colaborador', matricula: '100', senha: 'ana123' });
  const admin = await entrarAdmin();
  const res = await operar(admin, 'profissional.salvar', {
    id: 'p_1', name: 'Ana Souza', matricula: '100', matricula2: '', senha: 'nova-senha', baseColor: '#F44336', professionId: 'cargo_1', shift: 'manhã', isSupervisor: false,
  });
  assert.equal(res.statusCode, 200);
  assert.equal((await chamar(rotaDados, 'GET', { cookie: cookieAna })).statusCode, 401);
  await entrar({ tipo: 'colaborador', matricula: '100', senha: 'nova-senha' });
  assert.deepEqual(lerDados().professionals[0].bancoFolgas, BASE.professionals[0].bancoFolgas, 'o banco de folgas continua igual');
});

test('perfil do admin: pede a senha atual; a troca derruba as outras sessões do admin', async () => {
  const outraAba = await entrarAdmin();
  const cookie = await entrarAdmin();
  const errada = await operar(cookie, 'admin.perfil', { username: 'admin', senhaAtual: 'chute', novaSenha: 'senha-nova-do-admin' });
  assert.equal(errada.statusCode, 403);
  const certa = await operar(cookie, 'admin.perfil', { username: 'admin', senhaAtual: 'senha-do-admin', novaSenha: 'senha-nova-do-admin' });
  assert.equal(certa.statusCode, 200);
  assert.equal((await chamar(rotaDados, 'GET', { cookie: outraAba })).statusCode, 401);
  assert.equal((await chamar(rotaDados, 'GET', { cookie })).statusCode, 200);
  const antiga = await chamar(rotaLogin, 'POST', { body: { tipo: 'admin', usuario: 'admin', senha: 'senha-do-admin' } });
  assert.equal(antiga.statusCode, 401);
  await entrar({ tipo: 'admin', usuario: 'admin', senha: 'senha-nova-do-admin' });
});

// ---------- falhas do caminho ----------
test('GitHub fora: 503 com o nome da dependência, não 500', async () => {
  const cookie = await entrarAdmin();
  gist.fora = true;
  const res = await chamar(rotaDados, 'GET', { cookie });
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /GitHub/);
});

test('se o data.json muda no meio da operação, ela recomeça sobre a versão nova em vez de apagá-la', async () => {
  const cookie = await entrarAdmin();
  const leituraInicial = gist.leituras;
  // Logo depois da primeira leitura da operação, "outra aba" cadastra um cargo.
  gist.aoLer = (n) => {
    if (n === leituraInicial + 2) {
      const dados = lerDados();
      dados.professions.push({ id: 'cargo_outra_aba', name: 'Cargo da outra aba' });
      gist.files['data.json'] = JSON.stringify(dados, null, 2);
    }
  };
  const res = await operar(cookie, 'cargo.criar', { name: 'Cargo desta aba' });
  assert.equal(res.statusCode, 200);
  const nomes = lerDados().professions.map((c) => c.name);
  assert.ok(nomes.includes('Cargo da outra aba'), 'a mudança da outra aba não pode sumir');
  assert.ok(nomes.includes('Cargo desta aba'));
});

// ---------- migração ----------
test('migração: só a senha em claro vira hash, todo o resto fica igual, e rodar de novo não muda nada', async () => {
  const comAdminAntigo = { ...structuredClone(BASE), auth: { username: 'admin', password: 'senha-antiga' } };
  const { novo, resumo, conferencias } = await planejarMigracao(comAdminAntigo);
  assert.deepEqual(resumo.convertidas, ['admin', 'Carla Dias [p_3]']);
  assert.equal(conferencias.length, 2);
  assert.equal(novo.auth.password, undefined);
  assert.ok(await conferirSenha('senha-antiga', novo.auth.senhaHash));
  const carla = novo.professionals[2];
  assert.equal(carla.password, undefined);
  assert.ok(await conferirSenha('texto-puro', carla.senhaHash));
  assert.deepEqual(Object.keys(carla), ['id', 'name', 'matricula', 'matricula2', 'senhaHash', 'baseColor', 'professionId', 'shift', 'isSupervisor']);
  assert.deepEqual(novo.events, BASE.events);
  assert.deepEqual(novo.professionals[0], BASE.professionals[0]);
  assert.deepEqual(novo.campoQueOSistemaNaoConhece, { manter: true });

  const segunda = await planejarMigracao(novo);
  assert.deepEqual(segunda.novo, novo);
  assert.equal(segunda.resumo.convertidas.length, 0);
});
