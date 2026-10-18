// O detalhe de uma notificação. Novidade do sistema abre num modal; férias e escala abrem numa
// gaveta, onde o operador escolhe agir agora ou só ler e agir depois.
import { useEffect } from 'react';
import { dataBR } from '../../../shared/ferias.js';
import { nomeCategoria, quandoRelativo } from './comum';
import './index.css';

function useEsc(onFechar) {
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onFechar]);
}

function Novidade({ n, onFechar }) {
  useEsc(onFechar);
  return (
    <div className="notif-modal-overlay" onClick={onFechar}>
      <div className="notif-modal" role="dialog" aria-modal="true" aria-label={n.titulo} onClick={(e) => e.stopPropagation()}>
        <div className="notif-modal-topo">
          <span className="notif-chip sistema">Novidade do sistema</span>
          <span className="notif-data">{dataBR(n.data)}</span>
          <button type="button" className="btn-close-modal" onClick={onFechar} title="Fechar">&times;</button>
        </div>
        <h2>{n.titulo}</h2>
        {n.resumo && <p className="notif-modal-resumo">{n.resumo}</p>}
        {n.paragrafos?.map((p, i) => <p key={i} className="notif-modal-paragrafo">{p}</p>)}
        {n.itens?.length > 0 && (
          <ul className="notif-modal-itens">
            {n.itens.map((item, i) => (
              <li key={i}>
                {item.titulo && <strong>{item.titulo}</strong>}
                <span>{item.texto}</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn-save" onClick={onFechar}>Entendi</button>
      </div>
    </div>
  );
}

function Gaveta({ n, onFechar, onAcao }) {
  useEsc(onFechar);
  return (
    <>
      <div className="notif-gaveta-fundo" onClick={onFechar} />
      <aside className={`notif-gaveta ${n.categoria}`} role="dialog" aria-modal="true" aria-label={n.titulo}>
        <div className="notif-gaveta-topo">
          <span className={`notif-chip ${n.categoria}`}>{nomeCategoria(n.categoria)}</span>
          <span className="notif-data">{quandoRelativo(n.data)}</span>
          <button type="button" className="btn-close-modal" onClick={onFechar} title="Fechar">&times;</button>
        </div>
        <h2>{n.titulo}</h2>
        <p className="notif-gaveta-resumo">{n.resumo}</p>

        {n.detalhes?.length > 0 && (
          <dl className="notif-detalhes">
            {n.detalhes.map((d) => (
              <div key={d.rotulo} className="notif-detalhe">
                <dt>{d.rotulo}</dt>
                <dd>{d.valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {n.orientacao && <p className="notif-orientacao">{n.orientacao}</p>}

        <div className="notif-gaveta-acoes">
          {n.acao && (
            <button type="button" className="btn-save" onClick={() => onAcao(n)}>{n.acao.rotulo}</button>
          )}
          <button type="button" className="btn-cancel" onClick={onFechar}>Ler depois</button>
        </div>
      </aside>
    </>
  );
}

export default function Detalhe({ notificacao, onFechar, onAcao }) {
  if (!notificacao) return null;
  return notificacao.categoria === 'sistema'
    ? <Novidade n={notificacao} onFechar={onFechar} />
    : <Gaveta n={notificacao} onFechar={onFechar} onAcao={onAcao} />;
}
