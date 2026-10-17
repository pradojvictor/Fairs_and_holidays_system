// Copia os dados do Gist para uma pasta local, para testar o sistema na máquina sem tocar
// no Gist de verdade. Depois:  yarn dev:local
//
//   yarn dados:copiar      (= node --env-file=.env scripts/copiar-dados-locais.mjs)
//
// - No Gist, só LÊ. Nada é gravado lá.
// - A pasta fica fora do projeto (~/sistema-ferias-dados-locais, permissão 700): não entra
//   no git nem no deploy. Ela tem os dados reais, CIDs inclusive — apague quando terminar.
// - Senha ainda em texto puro vira hash só na cópia, com o mesmo código da migração: no teste
//   local, cada pessoa entra com a senha que já tem.
// - A sessão do Gist não é copiada: a cópia começa sem ninguém logado.
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lerGist } from '../api/_lib/gist.js';
import { planejarMigracao } from './migrar-senhas.mjs';

export const PASTA_PADRAO = join(homedir(), 'sistema-ferias-dados-locais');

async function principal() {
  const pasta = process.env.DADOS_LOCAIS || PASTA_PADRAO;
  const arquivo = process.env.GITHUB_FILENAME || 'data.json';

  const { dados } = await lerGist();
  const { novo, resumo } = await planejarMigracao(dados);

  await mkdir(pasta, { recursive: true, mode: 0o700 });
  await writeFile(join(pasta, arquivo), JSON.stringify(novo, null, 2), { mode: 0o600 });
  await writeFile(join(pasta, 'sessoes.json'), JSON.stringify({ sessoes: [] }), { mode: 0o600 });

  console.log(`Cópia salva em ${join(pasta, arquivo)} — o Gist não foi alterado.`);
  console.log(`${(novo.professionals || []).length} profissional(is), ${(novo.events || []).length} ausência(s).`);
  if (resumo.convertidas.length) {
    console.log(`${resumo.convertidas.length} senha(s) em texto puro viraram hash só na cópia (as mesmas senhas continuam valendo).`);
  }
  if (resumo.semSenha.length) {
    console.log(`Sem senha cadastrada (não entram nem no teste): ${resumo.semSenha.join(', ')}`);
  }
  console.log('\nAgora: yarn dev:local');
  console.log(`Quando terminar: rm -rf ${pasta}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  principal().catch((erro) => {
    console.error(`\nFalhou: ${erro.message}`);
    process.exitCode = 1;
  });
}
