// GET /api/notificacoes — a lista do admin (ver _lib/notificacoes.js).
// O que já foi lido fica no navegador (localStorage), por computador: não há rota para
// marcar como lida, e o servidor não guarda isso.
import { hojeISO } from '../shared/ferias.js';
import { lerGist } from './_lib/gist.js';
import { ErroPedido, rota } from './_lib/http.js';
import { ARQUIVO_NOTIFICACOES, lerEstadoNotificacoes, montarNotificacoes } from './_lib/notificacoes.js';
import { buscarNovidades } from './_lib/novidades.js';
import { resolverSessao, temCookieDeSessao } from './_lib/sessao.js';

const SEM_SESSAO = 'Sessão encerrada. Entre de novo.';

export default rota({
  GET: async (req, res) => {
    if (!temCookieDeSessao(req)) throw new ErroPedido(401, SEM_SESSAO);
    const leitura = await lerGist();
    const sessao = resolverSessao(req, leitura);
    if (!sessao) throw new ErroPedido(401, SEM_SESSAO);
    if (sessao.papel !== 'admin') throw new ErroPedido(403, 'As notificações são do painel do administrador.');
    const estado = lerEstadoNotificacoes(leitura.arquivos?.[ARQUIVO_NOTIFICACOES]);
    const novidades = await buscarNovidades();
    return res.status(200).json({ notificacoes: montarNotificacoes(leitura.dados, estado, hojeISO(), novidades) });
  },
});
