// POST /api/operacao — toda escrita do sistema, uma operação por pedido: { op, dados }.
// Só o admin escreve. Operação fora de OPERACOES é recusada antes de ler o Gist.
import { z } from 'zod';
import { alterarDados, lerGist } from './_lib/gist.js';
import { ErroPedido, corpoJson, rota, validar } from './_lib/http.js';
import { OPERACOES } from './_lib/operacoes.js';
import { encerrarSessoes, resolverSessao, temCookieDeSessao } from './_lib/sessao.js';

const SEM_SESSAO = 'Sessão encerrada. Entre de novo.';

const esquemaPedido = z.object({
  op: z.enum(Object.keys(OPERACOES)),
  dados: z.unknown(),
}).strict();

export default rota({
  POST: async (req, res) => {
    if (!temCookieDeSessao(req)) throw new ErroPedido(401, SEM_SESSAO);
    const pedido = validar(esquemaPedido, corpoJson(req));

    const leitura = await lerGist();
    const sessao = resolverSessao(req, leitura);
    if (!sessao) throw new ErroPedido(401, SEM_SESSAO);
    if (sessao.papel !== 'admin') throw new ErroPedido(403, 'Só o administrador altera os dados.');

    const operacao = OPERACOES[pedido.op];
    const valores = validar(operacao.esquema, pedido.dados);
    const preparo = operacao.preparar ? await operacao.preparar(valores, { req, leitura, sessao }) : {};

    let efeito = null;
    await alterarDados((dados) => {
      efeito = operacao.aplicar(dados, valores, preparo, { sessao });
      return efeito.dados;
    }, leitura);

    // Os dados já estão gravados; se derrubar as sessões falhar, fica no log. Quem foi
    // excluído perde o acesso de qualquer jeito (o cadastro sumiu); numa troca de senha, as
    // sessões antigas valeriam até vencer (8h).
    if (efeito.encerrar) {
      await encerrarSessoes(efeito.encerrar).catch((erro) => console.error('Encerrar sessões:', erro));
    }
    return res.status(200).json({ ok: true });
  },
});
