import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { iniciarAtualizacao } from './pwa/atualizacao.js'

// Registra o service worker e cuida da versão nova depois de um deploy (§5-C22).
iniciarAtualizacao()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
