// GET /api/dados — só com sessão, e cada papel recebe a sua visão (ver _lib/visoes.js).
// Nenhuma visão leva senha, hash ou a credencial do admin.
// A escrita saiu daqui: o PATCH que trocava o arquivo inteiro virou /api/operacao.
import { lerGist } from './_lib/gist.js';
import { ErroPedido, rota } from './_lib/http.js';
import { resolverSessao, temCookieDeSessao } from './_lib/sessao.js';
import { visaoAdmin, visaoColaborador } from './_lib/visoes.js';

const SEM_SESSAO = 'Sessão encerrada. Entre de novo.';

export default rota({
  GET: async (req, res) => {
    if (!temCookieDeSessao(req)) throw new ErroPedido(401, SEM_SESSAO);
    const leitura = await lerGist();
    const sessao = resolverSessao(req, leitura);
    if (!sessao) throw new ErroPedido(401, SEM_SESSAO);
    const visao = sessao.papel === 'admin' ? visaoAdmin(leitura.dados) : visaoColaborador(leitura.dados, sessao);
    return res.status(200).json(visao);
  },
});
