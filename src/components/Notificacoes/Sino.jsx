// Sino do cabeçalho: mostra quantas notificações não foram lidas e, ao clicar, a lista delas.
// Uma notificação só sai da lista quando o operador clica nela, ou em "Ver todas".
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nomeCategoria, quandoRelativo } from './comum';
import './index.css';

const MAX_NA_LISTA = 8;

export default function Sino({ notificacoes = [], onAbrir, onVerTodas }) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState(null);
  const caixaRef = useRef(null);
  const listaRef = useRef(null);
  const naoLidas = notificacoes.filter((n) => !n.lida);

  // A lista vai para o body (ver index.css) e se ancora embaixo do sino.
  const alternar = () => {
    if (!aberto) {
      const r = caixaRef.current.getBoundingClientRect();
      setPosicao({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
    }
    setAberto(!aberto);
  };

  // Fecha ao clicar fora, apertar Esc, rolar ou redimensionar a página.
  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = () => setAberto(false);
    const clique = (e) => {
      const dentro = caixaRef.current?.contains(e.target) || listaRef.current?.contains(e.target);
      if (!dentro) fechar();
    };
    const tecla = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('mousedown', clique);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', fechar);
    window.addEventListener('scroll', fechar);
    return () => {
      document.removeEventListener('mousedown', clique);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('scroll', fechar);
    };
  }, [aberto]);

  const abrir = (n) => {
    setAberto(false);
    onAbrir(n);
  };

  return (
    <div className="sino-wrapper" ref={caixaRef}>
      <button
        type="button"
        className={`btn-sino ${naoLidas.length ? 'tem-novas' : ''}`}
        onClick={alternar}
        aria-label={naoLidas.length ? `Notificações: ${naoLidas.length} ${naoLidas.length === 1 ? 'nova' : 'novas'}` : 'Notificações'}
        aria-expanded={aberto}
        title="Notificações"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2z" />
        </svg>
        {naoLidas.length > 0 && <span className="sino-contador">{naoLidas.length > 9 ? '9+' : naoLidas.length}</span>}
      </button>

      {aberto && posicao && createPortal(
        <div className="sino-lista" role="dialog" aria-label="Notificações novas" ref={listaRef} style={{ top: posicao.top, right: posicao.right }}>
          <div className="sino-lista-topo">
            <strong>Notificações</strong>
            <span>{naoLidas.length ? `${naoLidas.length} ${naoLidas.length === 1 ? 'nova' : 'novas'}` : 'nada novo'}</span>
          </div>

          {naoLidas.length === 0 ? (
            <p className="sino-vazio">Nenhuma notificação nova. As que você já leu ficam em "Ver todas".</p>
          ) : (
            <ul className="sino-itens">
              {naoLidas.slice(0, MAX_NA_LISTA).map((n) => (
                <li key={n.id}>
                  <button type="button" className="sino-item" onClick={() => abrir(n)}>
                    <span className={`notif-chip ${n.categoria}`}>{nomeCategoria(n.categoria)}</span>
                    <span className="sino-item-titulo">{n.titulo}</span>
                    <span className="sino-item-resumo">{n.resumo}</span>
                    <span className="sino-item-quando">{quandoRelativo(n.data)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {naoLidas.length > MAX_NA_LISTA && (
            <p className="sino-mais">E mais {naoLidas.length - MAX_NA_LISTA} — veja todas.</p>
          )}

          <button type="button" className="sino-ver-todas" onClick={() => { setAberto(false); onVerTodas(); }}>
            Ver todas
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
