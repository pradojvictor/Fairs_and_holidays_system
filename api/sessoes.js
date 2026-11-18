// Aba "Sessões ativas" do painel: onde o sistema está aberto, os computadores do painel (nome e
// PIN, ver _lib/aparelho.js) e os botões para derrubar um computador. Só o admin.
//   GET  /api/sessoes → { sessoes: [...], aparelhos: [...] }
//   POST /api/sessoes → { acao, ... }:
//     encerrar         { id }              uma sessão
//     encerrar-pessoa  { papel, usuario }  todas as de alguém (menos a deste computador)
//     nomear           { aparelho, nome }  nome do computador ('este' = o deste pedido)
//     esquecer         { aparelho }        tira o computador da lista (PIN junto) e derruba as
//                                          sessões abertas nele, menos a deste computador
//     definir-pin      { senhaAtual, pin } PIN deste computador; pede a senha do admin
//     remover-pin      { aparelho }
// A sessão deste computador não se encerra por aqui: para isso existe o "Sair do Sistema".
import { z } from 'zod';
import { lerGist } from './_lib/gist.js';
import { ErroPedido, corpoJson, rota, validar } from './_lib/http.js';
import { estaBloqueado, ipDoPedido, limparConta, registrarErro } from './_lib/limitador.js';
import { conferirSenha, gerarHash } from './_lib/senha.js';
import { descreverAparelho, encerrarSessoes, idDaSessao, resolverSessao, sessoesVivas, temCookieDeSessao } from './_lib/sessao.js';
import {
  DIGITOS_PIN, MENSAGEM_PIN_RECUSADO, aparelhoDoPedido, aparelhosDaLeitura, alterarAparelhoPorId,
  alterarEsteAparelho, idDoAparelho, pinAceitavel, visaoAparelho,
} from './_lib/aparelho.js';

const SEM_SESSAO = 'Sessão encerrada. Entre de novo.';
const idSessao = z.string().regex(/^[0-9a-f]{16}$/, 'id inválido');
const idAparelho = z.string().regex(/^[0-9a-f]{16}$/, 'id inválido');

const esquema = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('encerrar'), id: idSessao }).strict(),
  z.object({ acao: z.literal('encerrar-pessoa'), papel: z.enum(['admin', 'colaborador']), usuario: z.string().trim().min(1).max(64) }).strict(),
  z.object({ acao: z.literal('nomear'), aparelho: z.union([idAparelho, z.literal('este')]), nome: z.string().trim().max(40) }).strict(),
  z.object({ acao: z.literal('esquecer'), aparelho: idAparelho }).strict(),
  z.object({ acao: z.literal('definir-pin'), senhaAtual: z.string().min(1).max(200), pin: z.string().max(20) }).strict(),
  z.object({ acao: z.literal('remover-pin'), aparelho: idAparelho }).strict(),
]);

async function lerComoAdmin(req) {
  const leitura = await lerGist();
  const sessao = resolverSessao(req, leitura);
  if (!sessao) throw new ErroPedido(401, SEM_SESSAO);
  if (sessao.papel !== 'admin') throw new ErroPedido(403, 'Só o administrador vê as sessões.');
  return { leitura, sessao };
}

// Cada sessão com o nome de quem é, o aparelho, o nome do computador (se tiver) e os prazos.
// Sem hash nem token: os ids são o começo dos hashes. Sessão de quem saiu do cadastro já não
// vale e não aparece.
function visaoSessoes({ dados, sessoes }, atual, aparelhos) {
  const profissionais = new Map((dados.professionals || []).map((p) => [p.id, p]));
  const nomes = new Map(aparelhos.map((a) => [idDoAparelho(a), a.nome || '']));
  return sessoesVivas(sessoes)
    .map((s) => {
      let pessoa = null;
      if (s.papel === 'admin' && dados.auth) pessoa = `Administrador (${dados.auth.username || 'admin'})`;
      if (s.papel === 'colaborador') pessoa = profissionais.get(s.usuario)?.name || null;
      if (!pessoa) return null;
      return {
        id: idDaSessao(s),
        papel: s.papel,
        usuario: s.usuario,
        pessoa,
        aparelho: s.aparelho || '',
        computador: (s.aparelhoId && nomes.get(s.aparelhoId)) || '',
        entrouEm: s.criadaEm,
        usoEm: s.renovadaEm || s.criadaEm,
        expiraEm: s.expiraEm,
        lembrar: s.lembrar === true,
        atual: s.hash === atual.hash,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.atual) - Number(a.atual) || b.usoEm.localeCompare(a.usoEm));
}

function exigirAparelho(leitura, id) {
  const alvo = aparelhosDaLeitura(leitura).find((a) => idDoAparelho(a) === id);
  if (!alvo) throw new ErroPedido(404, 'Este computador já não está na lista.');
  return alvo;
}

export default rota({
  GET: async (req, res) => {
    if (!temCookieDeSessao(req)) throw new ErroPedido(401, SEM_SESSAO);
    const { leitura, sessao } = await lerComoAdmin(req);
    const aparelhos = aparelhosDaLeitura(leitura);
    const este = aparelhoDoPedido(req, leitura);
    return res.status(200).json({
      sessoes: visaoSessoes(leitura, sessao, aparelhos),
      aparelhos: aparelhos
        .map((a) => visaoAparelho(a, este))
        .sort((a, b) => Number(b.atual) - Number(a.atual) || String(b.usoEm).localeCompare(String(a.usoEm))),
      digitosPin: DIGITOS_PIN,
    });
  },

  POST: async (req, res) => {
    if (!temCookieDeSessao(req)) throw new ErroPedido(401, SEM_SESSAO);
    const pedido = validar(esquema, corpoJson(req));
    const { leitura, sessao } = await lerComoAdmin(req);
    const vivas = sessoesVivas(leitura.sessoes);

    if (pedido.acao === 'encerrar') {
      const alvo = vivas.find((s) => idDaSessao(s) === pedido.id);
      if (!alvo) throw new ErroPedido(404, 'Esta sessão já não está aberta.');
      if (alvo.hash === sessao.hash) {
        throw new ErroPedido(400, 'Esta é a sessão deste computador. Para sair dele, use "Sair do Sistema", no Painel Administrativo.');
      }
      await encerrarSessoes((s) => s.hash === alvo.hash, leitura);
      return res.status(200).json({ encerradas: 1 });
    }

    if (pedido.acao === 'encerrar-pessoa') {
      const filtro = (s) => s.papel === pedido.papel && s.usuario === pedido.usuario && s.hash !== sessao.hash;
      const encerradas = vivas.filter(filtro).length;
      await encerrarSessoes(filtro, leitura);
      return res.status(200).json({ encerradas });
    }

    if (pedido.acao === 'nomear') {
      // O nome não dá acesso a nada: é só o rótulo que aparece na lista e na tela do PIN.
      if (pedido.aparelho === 'este') {
        const descricao = descreverAparelho(req.headers?.['user-agent']);
        await alterarEsteAparelho(req, res, leitura, (a) => ({ ...a, nome: pedido.nome, descricao: a.descricao || descricao, usoEm: a.usoEm || new Date().toISOString() }));
      } else {
        exigirAparelho(leitura, pedido.aparelho);
        await alterarAparelhoPorId(pedido.aparelho, (a) => ({ ...a, nome: pedido.nome }), leitura);
      }
      return res.status(200).json({ ok: true });
    }

    if (pedido.acao === 'esquecer') {
      exigirAparelho(leitura, pedido.aparelho);
      await alterarAparelhoPorId(pedido.aparelho, () => null, leitura);
      const filtro = (s) => s.aparelhoId === pedido.aparelho && s.hash !== sessao.hash;
      const encerradas = vivas.filter(filtro).length;
      await encerrarSessoes(filtro, leitura);
      return res.status(200).json({ encerradas });
    }

    if (pedido.acao === 'remover-pin') {
      exigirAparelho(leitura, pedido.aparelho);
      await alterarAparelhoPorId(pedido.aparelho, ({ pinHash, pinDefinidoEm, ...resto }) => ({ ...resto, errosPin: 0 }), leitura); // eslint-disable-line no-unused-vars
      return res.status(200).json({ ok: true });
    }

    // definir-pin: só para ESTE computador, e só com a senha do admin — quem achar uma sessão
    // aberta não cria um PIN para si. Conferir senha fora do login leva limitador (§5-A2).
    const chaves = [`ip:${ipDoPedido(req)}`, 'conta:admin-pin'];
    if (estaBloqueado(chaves)) throw new ErroPedido(429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
    if (!(await conferirSenha(pedido.senhaAtual, leitura.dados.auth?.senhaHash))) {
      registrarErro(chaves);
      throw new ErroPedido(403, 'Senha atual incorreta.');
    }
    limparConta('conta:admin-pin');
    if (!pinAceitavel(pedido.pin)) throw new ErroPedido(400, MENSAGEM_PIN_RECUSADO);
    const pinHash = await gerarHash(pedido.pin);
    const agora = new Date().toISOString();
    const descricao = descreverAparelho(req.headers?.['user-agent']);
    // A senha acabou de ser conferida aqui: os 90 dias do PIN contam a partir de agora.
    const registro = await alterarEsteAparelho(req, res, leitura, ({ pinBloqueadoEm, ...a }) => ({ // eslint-disable-line no-unused-vars
      ...a,
      descricao: a.descricao || descricao,
      pinHash,
      pinDefinidoEm: agora,
      senhaEm: agora,
      usoEm: agora,
      errosPin: 0,
    }));
    // PIN novo começa sem os erros do antigo (o limitador em memória também os contava).
    limparConta(`conta:pin:${idDoAparelho(registro)}`);
    return res.status(200).json({ ok: true });
  },
});
