// Férias por tempo de serviço: a cada 12 meses da admissão, o sistema pergunta antes de lançar.
// O operador escolhe o ano de referência (sugestão: o ano que passou) e os dias (sugestão: 30),
// ou marca "já lançado" quando lançou à mão. Uma pergunta por profissional de cada vez, da
// mais antiga para a mais nova — é a ordem que o servidor exige (ferias.aniversario.resolver).
import { useState } from 'react';
import { runOperation } from '../../services/githubApi';
import { dataBR } from '../../../shared/ferias.js';
import './index.css';

export default function FeriasPendentesModal({ isOpen, onClose, pendencias = [], professionals = [], onDataUpdated, onResolvido }) {
  const [valores, setValores] = useState({});
  const [ocupado, setOcupado] = useState('');
  const [erro, setErro] = useState('');

  if (!isOpen) return null;

  const chave = (p) => `${p.professionalId}|${p.aniversario}`;
  const primeiras = pendencias.filter((p, i) => pendencias.findIndex((q) => q.professionalId === p.professionalId) === i);
  const valor = (p, campo) => valores[chave(p)]?.[campo] ?? (campo === 'year' ? p.anoSugerido : String(p.dias));
  const mudar = (p, campo, novo) => setValores({ ...valores, [chave(p)]: { ...valores[chave(p)], [campo]: novo } });

  const resolver = async (p, acao) => {
    const year = valor(p, 'year');
    const days = Number(valor(p, 'days'));
    if (acao === 'lancar' && (!/^\d{4}$/.test(year) || !(days >= 1))) {
      setErro('Informe o ano (4 dígitos) e os dias antes de lançar.');
      return;
    }
    setErro('');
    setOcupado(chave(p));
    try {
      await runOperation('ferias.aniversario.resolver', {
        professionalId: p.professionalId,
        aniversario: p.aniversario,
        acao,
        ...(acao === 'lancar' ? { year, days } : {}),
      });
      if (onResolvido) onResolvido(p, acao);
      if (onDataUpdated) await onDataUpdated();
    } catch (e) {
      setErro(e.message || 'Não foi possível salvar. Tente de novo.');
    } finally {
      setOcupado('');
    }
  };

  return (
    <div className="event-modal-overlay">
      <div className="event-modal-container ferias-pendentes">
        <div className="event-modal-header">
          <h3>Férias a lançar</h3>
          <button onClick={onClose} className="btn-close-modal" title="Fechar e perguntar depois">&times;</button>
        </div>

        {primeiras.length === 0 ? (
          <p className="ferias-pendentes-vazio">Tudo em dia: ninguém completou mais 12 meses sem lançamento.</p>
        ) : (
          <>
            <p className="ferias-pendentes-intro">
              Estas pessoas completaram mais 12 meses desde a admissão. Confira o ano de referência e os dias antes de lançar.
            </p>
            {erro && <div className="feedback-toast error" style={{ marginBottom: '0.8rem' }}>{erro}</div>}
            <div className="ferias-pendentes-lista">
              {primeiras.map((p) => {
                const pro = professionals.find((x) => x.id === p.professionalId);
                const depois = pendencias.filter((q) => q.professionalId === p.professionalId).length - 1;
                const salvando = ocupado === chave(p);
                return (
                  <div key={chave(p)} className="ferias-pendente">
                    <div className="ferias-pendente-topo">
                      <span className="ferias-pendente-cor" style={{ backgroundColor: pro?.baseColor || '#9ca3af' }} />
                      <strong>{pro?.name || 'Profissional'}</strong>
                      <span className="ferias-pendente-periodo">{p.periodo.rotulo}</span>
                    </div>
                    <div className="ferias-pendente-info">
                      Completou mais 12 meses em <strong>{dataBR(p.aniversario)}</strong>
                      {pro?.dataAdmissao && <> · admissão {dataBR(pro.dataAdmissao)}</>}
                      <br />
                      Período aquisitivo: {dataBR(p.periodo.inicio)} a {dataBR(p.periodo.fim)}
                    </div>
                    <div className="ferias-pendente-campos">
                      <label>
                        Férias referentes a
                        <input type="text" inputMode="numeric" maxLength={4} className="sidebar-input no-margin"
                          value={valor(p, 'year')} onChange={(e) => mudar(p, 'year', e.target.value.replace(/\D/g, ''))} disabled={salvando} />
                      </label>
                      <label>
                        Dias
                        <input type="number" min="1" max="366" className="sidebar-input no-margin"
                          value={valor(p, 'days')} onChange={(e) => mudar(p, 'days', e.target.value)} disabled={salvando} />
                      </label>
                    </div>
                    <div className="ferias-pendente-acoes">
                      <button className="btn-save" onClick={() => resolver(p, 'lancar')} disabled={Boolean(ocupado)}>
                        {salvando ? 'Salvando...' : `Lançar +${valor(p, 'days') || 0} dias`}
                      </button>
                      <button className="btn-cancel" onClick={() => resolver(p, 'dispensar')} disabled={Boolean(ocupado)}
                        title="Não acrescenta dias: use quando você já lançou estas férias à mão">
                        Já lançado
                      </button>
                    </div>
                    {depois > 0 && (
                      <small className="ferias-pendente-mais">Depois deste, há mais {depois} período(s) desta pessoa para conferir.</small>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button className="btn-cancel" onClick={onClose}>
          {primeiras.length ? 'Fechar — perguntar depois' : 'Fechar'}
        </button>
      </div>
    </div>
  );
}
