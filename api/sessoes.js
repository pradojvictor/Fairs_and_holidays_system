// Aba "Sessões ativas" do painel: onde o sistema está aberto, e o botão para derrubar um
// computador (perdido, ou de quem saiu sem clicar em "Sair"). Só o admin.
//   GET  /api/sessoes → { sessoes: [...] }
//   POST /api/sessoes → { alvo: 'sessao', id } encerra uma sessão;
//                       { alvo: 'pessoa', papel, usuario } encerra todas as de alguém.
// A sessão deste computador não se encerra por aqui: para isso existe o "Sair".
import { z } from 'zod';
import { lerGist } from './_lib/gist.js';
import { ErroPedido, corpoJson, rota, validar } from './_lib/http.js';
import { encerrarSessoes, idDaSessao, resolverSessao, sessoesVivas, temCookieDeSessao } from './_lib/sessao.js';

const SEM_SESSAO = 'Sessão encerrada. Entre de novo.';

const esquema = z.discriminatedUnion('alvo', [
  z.object({ alvo: z.literal('sessao'), id: z.string().regex(/^[0-9a-f]{16}$/, 'id inválido') }).strict(),
  z.object({ alvo: z.literal('pessoa'), papel: z.enum(['admin', 'colaborador']), usuario: z.string().trim().min(1).max(64) }).strict(),
]);

async function lerComoAdmin(req) {
  const leitura = await lerGist();
  const sessao = resolverSessao(req, leitura);
  if (!sessao) throw new ErroPedido(401, SEM_SESSAO);
  if (sessao.papel !== 'admin') throw new ErroPedido(403, 'Só o administrador vê as sessões.');
  return { leitura, sessao };
}

// Cada sessão com o nome de quem é, o aparelho e os prazos. Sem hash nem token: o id é o
// começo do hash (ver idDaSessao). Sessão de quem saiu do cadastro já não vale e não aparece.
function visaoSessoes({ dados, sessoes }, atual) {
  const profissionais = new Map((dados.professionals || []).map((p) => [p.id, p]));
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

export default rota({
  GET: async (req, res) => {
    if (!temCookieDeSessao(req)) throw new ErroPedido(401, SEM_SESSAO);
    const { leitura, sessao } = await lerComoAdmin(req);
    return res.status(200).json({ sessoes: visaoSessoes(leitura, sessao) });
  },

  POST: async (req, res) => {
    if (!temCookieDeSessao(req)) throw new ErroPedido(401, SEM_SESSAO);
    const pedido = validar(esquema, corpoJson(req));
    const { leitura, sessao } = await lerComoAdmin(req);
    const vivas = sessoesVivas(leitura.sessoes);

    let filtro;
    if (pedido.alvo === 'sessao') {
      const alvo = vivas.find((s) => idDaSessao(s) === pedido.id);
      if (!alvo) throw new ErroPedido(404, 'Esta sessão já não está aberta.');
      if (alvo.hash === sessao.hash) {
        throw new ErroPedido(400, 'Esta é a sessão deste computador. Para sair dele, use "Sair".');
      }
      filtro = (s) => s.hash === alvo.hash;
    } else {
      // Todas as da pessoa, menos a deste computador (quando a pessoa é o próprio admin).
      filtro = (s) => s.papel === pedido.papel && s.usuario === pedido.usuario && s.hash !== sessao.hash;
    }

    const encerradas = vivas.filter(filtro).length;
    await encerrarSessoes(filtro, leitura);
    return res.status(200).json({ encerradas });
  },
});
