// /api/login — confere a credencial no servidor e abre a sessão no cookie.
// POST serve três entradas: a do admin (usuário + senha), a do portal (matrícula + senha) e a do
// admin por PIN, que só vale num computador já validado com a senha (ver _lib/aparelho.js).
// GET diz à tela de login se ESTE computador aceita PIN (e o nome dele); sem o cookie do
// computador, a resposta é sempre "não".
import { z } from 'zod';
import { lerGist } from './_lib/gist.js';
import { ErroPedido, corpoJson, rota, validar } from './_lib/http.js';
import { estaBloqueado, ipDoPedido, limparConta, registrarErro } from './_lib/limitador.js';
import { conferirSenha } from './_lib/senha.js';
import { abrirSessao, descreverAparelho } from './_lib/sessao.js';
import {
  DIGITOS_PIN, ERROS_ATE_BLOQUEAR, aparelhoDoPedido, alterarAparelhoPorId, alterarEsteAparelho,
  idDoAparelho, pinVale, temCookieDeAparelho,
} from './_lib/aparelho.js';

const lembrar = z.boolean().optional();
const esquema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('admin'), usuario: z.string().min(1).max(100), senha: z.string().min(1).max(200), lembrar }).strict(),
  z.object({ tipo: z.literal('colaborador'), matricula: z.string().trim().min(1).max(40), senha: z.string().min(1).max(200), lembrar }).strict(),
  z.object({ tipo: z.literal('pin'), pin: z.string().regex(new RegExp(`^\\d{${DIGITOS_PIN}}$`), `PIN de ${DIGITOS_PIN} números`), lembrar }).strict(),
]);

// Uma frase só para conta inexistente e senha errada (padrão 1.1).
const RECUSA = 'Usuário ou senha incorretos.';
const MUITAS = 'Muitas tentativas. Aguarde 15 minutos e tente de novo.';
const PIN_NAO_VALE = 'O PIN não vale neste computador. Entre com usuário e senha.';
const DIA_MS = 24 * 60 * 60 * 1000;

// Entrada por PIN: o computador tem de estar na lista, com PIN válido; cada erro conta no Gist
// (não só na memória da instância), e o quinto apaga o PIN daquele computador.
async function entrarComPin(req, res, entrada) {
  const ip = `ip:${ipDoPedido(req)}`;
  if (estaBloqueado([ip])) throw new ErroPedido(429, MUITAS);
  if (!temCookieDeAparelho(req)) {
    registrarErro([ip]);
    throw new ErroPedido(401, PIN_NAO_VALE);
  }
  const leitura = await lerGist();
  const aparelho = aparelhoDoPedido(req, leitura);
  const chaves = [ip, `conta:pin:${idDoAparelho(aparelho) || '-'}`];
  if (estaBloqueado(chaves)) throw new ErroPedido(429, MUITAS);
  if (!aparelho || !pinVale(aparelho) || !leitura.dados.auth) {
    registrarErro([ip]);
    throw new ErroPedido(401, PIN_NAO_VALE);
  }

  if (!(await conferirSenha(entrada.pin, aparelho.pinHash))) {
    registrarErro(chaves);
    // A conta parte do registro relido a cada tentativa de gravar: dois erros quase juntos
    // não viram um só.
    let erros = 0;
    let bloqueia = false;
    await alterarAparelhoPorId(idDoAparelho(aparelho), (a) => {
      erros = (a.errosPin || 0) + 1;
      bloqueia = erros >= ERROS_ATE_BLOQUEAR;
      if (!bloqueia) return { ...a, errosPin: erros };
      const { pinHash, pinDefinidoEm, ...resto } = a; // eslint-disable-line no-unused-vars
      return { ...resto, errosPin: 0, pinBloqueadoEm: new Date().toISOString() };
    }, leitura);
    if (bloqueia) {
      throw new ErroPedido(401, `PIN errado ${ERROS_ATE_BLOQUEAR} vezes: ele foi apagado deste computador. Entre com usuário e senha.`);
    }
    const restam = ERROS_ATE_BLOQUEAR - erros;
    throw new ErroPedido(401, `PIN incorreto. ${restam === 1 ? 'Mais 1 erro' : `Mais ${restam} erros`} e este computador volta a pedir a senha.`);
  }

  limparConta(chaves[1]);
  const agora = Date.now();
  if (aparelho.errosPin || !(agora - Date.parse(aparelho.usoEm || 0) < DIA_MS)) {
    await alterarAparelhoPorId(idDoAparelho(aparelho), (a) => ({ ...a, errosPin: 0, usoEm: new Date(agora).toISOString() }), leitura);
  }
  await abrirSessao(res, 'admin', 'admin', leitura, {
    lembrar: entrada.lembrar === true,
    aparelho: descreverAparelho(req.headers?.['user-agent']),
    aparelhoId: idDoAparelho(aparelho),
  });
  return res.status(200).json({ papel: 'admin' });
}

export default rota({
  GET: async (req, res) => {
    if (!temCookieDeAparelho(req)) return res.status(200).json({ pin: false });
    const leitura = await lerGist();
    const aparelho = aparelhoDoPedido(req, leitura);
    if (!pinVale(aparelho)) return res.status(200).json({ pin: false });
    return res.status(200).json({ pin: true, nome: aparelho.nome || '' });
  },

  POST: async (req, res) => {
    const entrada = validar(esquema, corpoJson(req));
    if (entrada.tipo === 'pin') return entrarComPin(req, res, entrada);
    const identificador = entrada.tipo === 'admin' ? entrada.usuario : entrada.matricula;

    // A chave da conta é o que foi digitado, exista a conta ou não: se só conta existente
    // fosse limitada, o 429 diria quem existe (regra C6). Quem planta chave esbarra no
    // limite por IP, e o Map tem teto.
    const chaveConta = `conta:${entrada.tipo}:${identificador}`;
    const chaves = [`ip:${ipDoPedido(req)}`, chaveConta];
    if (estaBloqueado(chaves)) throw new ErroPedido(429, MUITAS);

    const leitura = await lerGist();
    const { dados } = leitura;
    let conta = null;
    let guardado = null;
    // Mesma comparação de antes: o admin compara como digitou; o portal tira espaços.
    let senha = entrada.senha;
    if (entrada.tipo === 'admin') {
      if (dados.auth && dados.auth.username === entrada.usuario) {
        conta = 'admin';
        guardado = dados.auth.senhaHash;
      }
    } else {
      senha = senha.trim();
      const pro = (dados.professionals || []).find((p) => p.matricula === entrada.matricula);
      if (pro) {
        conta = pro.id;
        guardado = pro.senhaHash;
      }
    }

    // conferirSenha roda o scrypt mesmo sem conta (hash fantasma): o tempo não denuncia.
    const confere = await conferirSenha(senha, guardado);
    if (!conta || !confere) {
      registrarErro(chaves);
      throw new ErroPedido(401, RECUSA);
    }
    limparConta(chaveConta);

    const aparelho = descreverAparelho(req.headers?.['user-agent']);
    let aparelhoId = '';
    if (entrada.tipo === 'admin') {
      // Senha completa do admin: este computador fica validado (é isso que deixa o PIN valer
      // aqui, e conta os 90 dias do PIN de novo).
      const agora = new Date().toISOString();
      const registro = await alterEsteOuNulo(req, res, leitura, (a) => ({ ...a, descricao: aparelho, senhaEm: agora, usoEm: agora, errosPin: 0 }));
      aparelhoId = registro ? idDoAparelho(registro) : '';
    }
    await abrirSessao(res, entrada.tipo, conta, leitura, { lembrar: entrada.lembrar === true, aparelho, aparelhoId });
    return res.status(200).json({ papel: entrada.tipo });
  },
});

// Validar o computador não pode impedir o login: se o Gist falhar aqui, a pessoa entra mesmo
// assim (só sem o PIN valer neste computador até a próxima vez).
async function alterEsteOuNulo(req, res, leitura, mudar) {
  try {
    return await alterarEsteAparelho(req, res, leitura, mudar);
  } catch (erro) {
    console.error('Validar o computador:', erro?.message || erro);
    return null;
  }
}
