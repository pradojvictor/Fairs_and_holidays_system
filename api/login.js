// POST /api/login — confere a senha no servidor e abre a sessão no cookie.
// Serve os dois logins: o do admin (usuário + senha) e o do portal (matrícula + senha).
import { z } from 'zod';
import { lerGist } from './_lib/gist.js';
import { ErroPedido, corpoJson, rota, validar } from './_lib/http.js';
import { estaBloqueado, ipDoPedido, limparConta, registrarErro } from './_lib/limitador.js';
import { conferirSenha } from './_lib/senha.js';
import { abrirSessao } from './_lib/sessao.js';

const esquema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('admin'), usuario: z.string().min(1).max(100), senha: z.string().min(1).max(200) }).strict(),
  z.object({ tipo: z.literal('colaborador'), matricula: z.string().trim().min(1).max(40), senha: z.string().min(1).max(200) }).strict(),
]);

// Uma frase só para conta inexistente e senha errada (padrão 1.1).
const RECUSA = 'Usuário ou senha incorretos.';

export default rota({
  POST: async (req, res) => {
    const entrada = validar(esquema, corpoJson(req));
    const identificador = entrada.tipo === 'admin' ? entrada.usuario : entrada.matricula;

    // A chave da conta é o que foi digitado, exista a conta ou não: se só conta existente
    // fosse limitada, o 429 diria quem existe (regra C6). Quem planta chave esbarra no
    // limite por IP, e o Map tem teto.
    const chaveConta = `conta:${entrada.tipo}:${identificador}`;
    const chaves = [`ip:${ipDoPedido(req)}`, chaveConta];
    if (estaBloqueado(chaves)) {
      throw new ErroPedido(429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
    }

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
    await abrirSessao(res, entrada.tipo, conta, leitura);
    return res.status(200).json({ papel: entrada.tipo });
  },
});
