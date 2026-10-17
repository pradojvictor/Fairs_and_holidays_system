// O que toda rota da API faz igual: método, origem, corpo, validação e tradução de erro.
import { ErroConfiguracao, ErroConflito, ErroDependencia } from './gist.js';

export class ErroPedido extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const LIMITE_CORPO = 20_000;

// Escrita só de páginas da mesma origem e só em JSON. O cookie já é SameSite=Strict; isto
// fecha o resto (formulário de outro site não manda application/json sem preflight).
function conferirPedidoDeEscrita(req) {
  const origem = req.headers?.origin;
  if (origem) {
    let host = null;
    try { host = new URL(origem).host; } catch { /* origem malformada */ }
    if (host !== req.headers.host) throw new ErroPedido(403, 'Origem não permitida.');
  }
  if (!String(req.headers?.['content-type'] || '').startsWith('application/json')) {
    throw new ErroPedido(415, 'Envie o corpo em JSON.');
  }
}

export function corpoJson(req) {
  let corpo;
  try {
    corpo = req.body;
  } catch {
    throw new ErroPedido(400, 'JSON inválido.');
  }
  if (corpo === undefined || corpo === null || corpo === '') corpo = {};
  if (typeof corpo !== 'object' || JSON.stringify(corpo).length > LIMITE_CORPO) {
    throw new ErroPedido(400, 'Corpo do pedido inválido.');
  }
  return corpo;
}

export function validar(esquema, valor) {
  const resultado = esquema.safeParse(valor);
  if (resultado.success) return resultado.data;
  const motivos = resultado.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || 'pedido'}: ${i.message}`);
  throw new ErroPedido(400, `Dados inválidos — ${motivos.join('; ')}`);
}

export function rota(metodos) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const handler = metodos[req.method];
      if (!handler) {
        res.setHeader('Allow', Object.keys(metodos).join(', '));
        return res.status(405).json({ error: 'Método não permitido.' });
      }
      if (req.method !== 'GET') conferirPedidoDeEscrita(req);
      return await handler(req, res);
    } catch (erro) {
      if (erro instanceof ErroPedido) return res.status(erro.status).json({ error: erro.message });
      if (erro instanceof ErroConflito) return res.status(409).json({ error: erro.message });
      if (erro instanceof ErroDependencia) {
        console.error('GitHub indisponível:', erro.message);
        return res.status(503).json({ error: 'O GitHub, onde ficam os dados, não respondeu. Tente de novo em alguns minutos.' });
      }
      if (erro instanceof ErroConfiguracao) console.error('Configuração:', erro.message);
      else console.error('Erro na API:', erro);
      return res.status(500).json({ error: 'Erro interno.' });
    }
  };
}
