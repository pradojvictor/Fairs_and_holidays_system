// "Ver todas": a central em tela cheia, com as notificações recentes — lidas ou não —
// separadas por categoria. Clicar numa abre o detalhe (modal ou gaveta) por cima.
import { useEffect, useState } from 'react';
import { dataBR } from '../../../shared/ferias.js';
import { CATEGORIAS, nomeCategoria, quandoRelativo } from './comum';
import './index.css';

function Cartao({ n, onAbrir }) {
  return (
    <button type="button" className={`central-cartao ${n.lida ? 'lida' : 'nova'}`} onClick={() => onAbrir(n)}>
      <div className="central-cartao-topo">
        <span className={`notif-chip ${n.categoria}`}>{nomeCategoria(n.categoria)}</span>
        {n.importante && <span className="notif-selo-importante">Importante</span>}
        <span className="central-cartao-estado">{n.lida ? `Lida${n.lidaEm ? ` em ${dataBR(n.lidaEm.slice(0, 10))}` : ''}` : 'Nova'}</span>
        <span className="central-cartao-quando">{quandoRelativo(n.data)}</span>
      </div>
      <strong className="central-cartao-titulo">{n.titulo}</strong>
      <span className="central-cartao-resumo">{n.resumo}</span>
    </button>
  );
}

export default function Central({ notificacoes = [], onFechar, onAbrir }) {
  const [aba, setAba] = useState('todas');

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onFechar]);

  const daCategoria = (id) => notificacoes.filter((n) => n.categoria === id);
  const abas = [{ id: 'todas', nome: 'Todas', total: notificacoes.length }, ...CATEGORIAS.map((c) => ({ ...c, total: daCategoria(c.id).length }))];
  const grupos = aba === 'todas' ? CATEGORIAS : CATEGORIAS.filter((c) => c.id === aba);

  return (
    <div className="central-overlay" role="dialog" aria-modal="true" aria-label="Central de notificações">
      <div className="central-painel">
        <div className="central-topo">
          <div>
            <h2>Central de notificações</h2>
            <p>Tudo o que o sistema avisou recentemente, lido ou não. Clique em uma para ver os detalhes.</p>
          </div>
          <button type="button" className="btn-close-modal" onClick={onFechar} title="Fechar">&times;</button>
        </div>

        <div className="central-abas" role="tablist">
          {abas.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id}
              className={`central-aba ${aba === a.id ? 'ativa' : ''} ${a.id}`} onClick={() => setAba(a.id)}>
              {a.nome} <span>{a.total}</span>
            </button>
          ))}
        </div>

        <div className="central-conteudo">
          {grupos.map((c) => {
            const itens = daCategoria(c.id);
            return (
              <section key={c.id} className="central-grupo">
                <h3>{c.nome} <small>{c.descricao}</small></h3>
                {itens.length === 0 ? (
                  <p className="central-vazio">Nada por aqui.</p>
                ) : (
                  <div className="central-cartoes">
                    {itens.map((n) => <Cartao key={n.id} n={n} onAbrir={onAbrir} />)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
