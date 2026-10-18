import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync } from 'node:fs'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

// `yarn dev:local`: o "Gist" passa a ser a pasta DADOS_LOCAIS, criada por
// `yarn dados:copiar`. A API roda igual, mas lê e grava nos arquivos da pasta, e qualquer
// outra chamada ao GitHub é recusada — o Gist de verdade fica fora de alcance.
function usarGistLocal(pasta) {
  const fetchReal = globalThis.fetch
  globalThis.fetch = async (url, opcoes = {}) => {
    const endereco = String(url)
    if (!/^https:\/\/([a-z.]+\.)?(github\.com|githubusercontent\.com)\//.test(endereco)) return fetchReal(url, opcoes)
    // Novidades do sistema (issues do GitHub): no modo local, vêm do issues.json da pasta, se
    // existir — serve para ver como uma novidade fica antes de publicá-la. Sem o arquivo, lê as
    // issues de verdade do repositório (público, só leitura).
    if (endereco.startsWith('https://api.github.com/repos/')) {
      const arquivo = join(pasta, 'issues.json')
      if (existsSync(arquivo)) {
        return new Response(await readFile(arquivo, 'utf8'), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if ((opcoes.method || 'GET') !== 'GET') throw new Error('[dados-locais] só leitura nas issues do GitHub')
      return fetchReal(url, opcoes)
    }
    if (!endereco.startsWith('https://api.github.com/gists/')) {
      throw new Error(`[dados-locais] chamada ao GitHub recusada: ${endereco}`)
    }
    if ((opcoes.method || 'GET') === 'PATCH') {
      for (const [nome, arquivo] of Object.entries(JSON.parse(opcoes.body).files)) {
        if (nome !== basename(nome)) throw new Error(`[dados-locais] nome de arquivo inválido: ${nome}`)
        await writeFile(join(pasta, nome), arquivo.content, { mode: 0o600 })
      }
      return new Response('{}', { status: 200 })
    }
    const files = {}
    for (const nome of await readdir(pasta)) {
      if (nome.endsWith('.json') && nome !== 'issues.json') files[nome] = { filename: nome, content: await readFile(join(pasta, nome), 'utf8'), truncated: false }
    }
    return new Response(JSON.stringify({ files }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
}

// `yarn dev` sem a Vercel: as rotas de /api rodam dentro do servidor do Vite, com os
// mesmos arquivos que vão para produção. Só existe no servidor de desenvolvimento
// (apply: 'serve') — o build e a Vercel não passam por aqui.
// `yarn dev` usa o Gist do .env, o de verdade: o que se grava ali grava lá.
// `yarn dev:local` usa a cópia local (ver usarGistLocal).
// Mudou algo em api/? Reinicie o servidor (o Node guarda o módulo já carregado).
function apiLocal() {
  return {
    name: 'api-local',
    apply: 'serve',
    configureServer(server) {
      // O .env vira process.env, como a Vercel faz com as variáveis do projeto.
      // Fica no processo do servidor: nada disto vai para o navegador.
      const env = loadEnv(server.config.mode, server.config.root, '')
      for (const [chave, valor] of Object.entries(env)) process.env[chave] ??= valor
      // http://localhost não é HTTPS: sem isto o Safari recusa o cookie Secure.
      process.env.COOKIE_SEGURO ??= 'nao'

      const pastaLocal = process.env.DADOS_LOCAIS
      if (pastaLocal) {
        const arquivo = join(pastaLocal, process.env.GITHUB_FILENAME || 'data.json')
        if (!existsSync(arquivo)) {
          throw new Error(`[dados-locais] ${arquivo} não existe. Rode antes: yarn dados:copiar`)
        }
        process.env.GITHUB_GIST_ID ??= 'local'
        process.env.GITHUB_TOKEN ??= 'local'
        usarGistLocal(pastaLocal)
        server.config.logger.info(`\n  Dados LOCAIS: ${pastaLocal} — o Gist de verdade não é tocado.\n`)
      } else {
        server.config.logger.warn('\n  Dados do Gist de VERDADE (.env): o que você gravar aqui vai para produção.\n  Para testar sem risco: yarn dados:copiar e depois yarn dev:local\n')
      }

      server.middlewares.use(async (req, res, next) => {
        const { pathname } = new URL(req.url, 'http://localhost')
        if (!pathname.startsWith('/api/')) return next()

        // Só rotas de verdade (api/<nome>.js): o código de api/_lib nunca é servido.
        const nome = pathname.slice('/api/'.length)
        let rota
        try {
          if (!/^[a-z]+$/.test(nome)) throw new Error('rota inválida')
          rota = (await import(pathToFileURL(join(server.config.root, 'api', `${nome}.js`)).href)).default
        } catch {
          res.statusCode = 404
          return res.end()
        }

        // O formato que a Vercel entrega ao handler: corpo JSON já lido e res.status().json().
        let bruto = ''
        for await (const parte of req) bruto += parte
        const ehJson = String(req.headers['content-type'] || '').startsWith('application/json')
        let corpo = bruto || undefined
        let erroCorpo = null
        if (bruto && ehJson) {
          try { corpo = JSON.parse(bruto) } catch (erro) { erroCorpo = erro }
        }
        Object.defineProperty(req, 'body', {
          get() {
            if (erroCorpo) throw erroCorpo
            return corpo
          },
        })
        res.status = (codigo) => {
          res.statusCode = codigo
          return res
        }
        res.json = (dados) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(dados))
          return res
        }
        try {
          await rota(req, res)
        } catch (erro) {
          console.error('[api-local]', erro)
          if (!res.headersSent) {
            res.statusCode = 500
            res.end()
          }
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    apiLocal(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Calendário de Ausências da Equipe',
        short_name: 'EscalaApp',
        description: 'Gerenciamento de férias e folgas da equipe',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
