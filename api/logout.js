// POST /api/logout — apaga o cookie e tira a sessão do Gist: o token deixa de valer no
// servidor, não só no navegador.
import { lerGist } from './_lib/gist.js';
import { rota } from './_lib/http.js';
import { apagarCookie, encerrarSessoes, resolverSessao, temCookieDeSessao } from './_lib/sessao.js';

export default rota({
  POST: async (req, res) => {
    apagarCookie(res);
    if (temCookieDeSessao(req)) {
      const leitura = await lerGist();
      const sessao = resolverSessao(req, leitura);
      if (sessao) await encerrarSessoes((s) => s.hash === sessao.hash, leitura);
    }
    return res.status(204).end();
  },
});
