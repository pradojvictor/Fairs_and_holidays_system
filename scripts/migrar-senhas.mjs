// Converte as senhas em texto puro do data.json em hash scrypt. Roda uma vez, à mão,
// logo depois de publicar a versão nova (que não aceita mais senha em claro).
//
//   node --env-file=.env scripts/migrar-senhas.mjs           → só mostra o que faria
//   node --env-file=.env scripts/migrar-senhas.mjs --gravar  → grava
//
// O arquivo de ambiente precisa de GITHUB_GIST_ID, GITHUB_TOKEN e GITHUB_FILENAME com os
// MESMOS valores da Vercel (Settings → Environment Variables → Production): é o Gist de
// produção que tem de ser migrado. Se o seu arquivo for outro (.env.local, por exemplo),
// troque o nome no --env-file.
//
// Cuidados com os dados:
// - Antes de tudo, salva uma cópia do data.json em ~/sistema-ferias-backup/ (permissão 600),
//   fora do projeto para nunca subir em deploy. A cópia tem as senhas e os atestados em
//   claro: apague-a depois de conferir que os logins funcionam.
// - Só mexe em `auth.password` e `professionals[].password`. O resto do arquivo é comparado
//   campo a campo antes de gravar e precisa sair idêntico; se não sair, nada é gravado.
// - Se o data.json mudar entre a leitura e a gravação, para sem gravar.
// - Depois de gravar, relê o Gist e confere cada hash contra a senha original.
// - Pode rodar de novo: quem já tem senhaHash é pulado.
// - Quem está com senha vazia continua sem senha (e sem acesso) — o resumo lista.
// - O histórico de revisões do Gist continua com as senhas antigas em claro. Depois de
//   migrar, troque as senhas.
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { alterarDados, lerGist } from '../api/_lib/gist.js';
import { conferirSenha, ehHashScrypt, gerarHash } from '../api/_lib/senha.js';

// Troca `password` por `senhaHash` na mesma posição do objeto, para o diff do Gist ficar limpo.
function trocarCampo(obj, hash) {
  const saida = {};
  for (const [chave, valor] of Object.entries(obj)) {
    if (chave === 'password') {
      if (hash && !('senhaHash' in obj)) saida.senhaHash = hash;
    } else {
      saida[chave] = valor;
    }
  }
  if (hash && 'senhaHash' in obj) saida.senhaHash = hash;
  return saida;
}

// Remove só os campos de credencial: o que sobra tem de ser igual antes e depois.
function semCredenciais(dados) {
  const limpar = (o) => {
    if (!o || typeof o !== 'object') return o;
    const { password: _p, senhaHash: _h, ...resto } = o;
    return resto;
  };
  return {
    ...dados,
    ...(dados.auth ? { auth: limpar(dados.auth) } : {}),
    ...(Array.isArray(dados.professionals) ? { professionals: dados.professionals.map(limpar) } : {}),
  };
}

async function migrarConta(conta, chave, rotulo, resumo, conferencias) {
  if (!conta || typeof conta !== 'object') return conta;
  const temHash = ehHashScrypt(conta.senhaHash);
  const temClaro = typeof conta.password === 'string' && conta.password !== '';
  if (temHash) {
    resumo.jaTinhamHash.push(rotulo);
    // Hash válido já manda; a senha em claro que sobrou é campo morto e sai.
    return 'password' in conta ? trocarCampo(conta, null) : conta;
  }
  if (!temClaro) {
    resumo.semSenha.push(rotulo);
    return conta;
  }
  const hash = await gerarHash(conta.password);
  conferencias.push({ chave, rotulo, senha: conta.password });
  resumo.convertidas.push(rotulo);
  return trocarCampo(conta, hash);
}

export async function planejarMigracao(dados) {
  const resumo = { convertidas: [], jaTinhamHash: [], semSenha: [] };
  const conferencias = [];
  const novo = { ...dados };
  if (dados.auth) novo.auth = await migrarConta(dados.auth, 'admin', 'admin', resumo, conferencias);
  if (Array.isArray(dados.professionals)) {
    novo.professionals = [];
    for (const p of dados.professionals) {
      novo.professionals.push(await migrarConta(p, p.id, `${p.name || '(sem nome)'} [${p.id}]`, resumo, conferencias));
    }
  }
  if (!isDeepStrictEqual(semCredenciais(dados), semCredenciais(novo))) {
    throw new Error('A conversão mudaria campos além das senhas. Nada foi gravado.');
  }
  return { novo, resumo, conferencias };
}

function guardadoPara(dados, chave) {
  if (chave === 'admin') return dados.auth?.senhaHash;
  return dados.professionals?.find((p) => p.id === chave)?.senhaHash;
}

async function principal() {
  const gravar = process.argv.includes('--gravar');
  const leitura = await lerGist();
  const original = leitura.dados;

  const pasta = join(homedir(), 'sistema-ferias-backup');
  await mkdir(pasta, { recursive: true, mode: 0o700 });
  const arquivoBackup = join(pasta, `${process.env.GITHUB_FILENAME || 'data.json'}.${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(arquivoBackup, leitura.textoDados, { mode: 0o600 });
  await chmod(arquivoBackup, 0o600);
  console.log(`Cópia do data.json salva em ${arquivoBackup} (tem senhas em claro: apague depois).`);

  const { novo, resumo, conferencias } = await planejarMigracao(original);
  console.log(`\nVão virar hash: ${resumo.convertidas.length}`);
  for (const r of resumo.convertidas) console.log(`  • ${r}`);
  console.log(`Já tinham hash (pulados): ${resumo.jaTinhamHash.length}`);
  if (resumo.semSenha.length) {
    console.log(`Sem senha cadastrada (continuam sem acesso até o admin definir uma): ${resumo.semSenha.length}`);
    for (const r of resumo.semSenha) console.log(`  • ${r}`);
  }
  console.log('Fora as senhas, o arquivo sai idêntico: conferido.');

  if (!gravar) {
    console.log('\nNada foi gravado. Para aplicar: acrescente --gravar.');
    return;
  }
  if (isDeepStrictEqual(novo, original)) {
    console.log('\nNada a converter.');
    return;
  }

  await alterarDados((atual) => {
    if (!isDeepStrictEqual(atual, original)) {
      throw new Error('O data.json mudou desde a leitura. Nada foi gravado — rode de novo.');
    }
    return novo;
  }, leitura);

  const depois = (await lerGist()).dados;
  if (!isDeepStrictEqual(semCredenciais(depois), semCredenciais(original))) {
    throw new Error(`O Gist relido difere do original fora das senhas. Restaure a cópia ${arquivoBackup}.`);
  }
  for (const { chave, rotulo, senha } of conferencias) {
    if (!(await conferirSenha(senha, guardadoPara(depois, chave)))) {
      throw new Error(`O hash gravado de ${rotulo} não confere. Restaure a cópia ${arquivoBackup}.`);
    }
  }
  console.log(`\nGravado e conferido: ${conferencias.length} senha(s) viraram hash, e cada uma confere com a original.`);
  console.log(`Agora: teste os logins, apague ${arquivoBackup} e troque as senhas (o histórico do Gist ainda tem as antigas).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  principal().catch((erro) => {
    console.error(`\nFalhou: ${erro.message}`);
    process.exitCode = 1;
  });
}
