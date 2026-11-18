// Aba "Sessões ativas": em quais computadores e celulares o sistema está aberto, por pessoa,
// com o botão para derrubar um deles — o computador perdido, ou o de quem saiu sem clicar em
// "Sair do Sistema". Encerrar vale na hora: quem estiver lá precisa da senha para entrar de novo.
// Embaixo, os computadores do painel: nome e PIN (ver Computadores.jsx).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSessions, sessionAction } from '../../services/githubApi';
import BotaoConfirmar from './BotaoConfirmar';
import Computadores from './Computadores';
import '../Notificacoes/index.css';
import './index.css';

const fuso = { timeZone: 'America/Fortaleza' };
const diaDe = (iso) => new Date(iso).toLocaleDateString('pt-BR', fuso);
const horaDe = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { ...fuso, hour: '2-digit', minute: '2-digit' });

function quando(iso) {
  const hoje = diaDe(new Date().toISOString());
  const ontem = diaDe(new Date(Date.now() - 86_400_000).toISOString());
  const dia = diaDe(iso);
  if (dia === hoje) return `hoje, ${horaDe(iso)}`;
  if (dia === ontem) return `ontem, ${horaDe(iso)}`;
  return `${dia.slice(0, 5)}, ${horaDe(iso)}`;
}

function agruparPorPessoa(sessoes) {
  const grupos = new Map();
  for (const s of sessoes) {
    const chave = `${s.papel}:${s.usuario}`;
    if (!grupos.has(chave)) grupos.set(chave, { chave, papel: s.papel, usuario: s.usuario, pessoa: s.pessoa, sessoes: [] });
    grupos.get(chave).sessoes.push(s);
  }
  return [...grupos.values()];
}

// Nome do aparelho na lista: o nome que o admin deu ao computador, se tiver, e o navegador.
const rotuloAparelho = (s) => [s.computador, s.aparelho || (s.computador ? '' : 'Aparelho não identificado')].filter(Boolean).join(' · ');

export default function SessoesAtivas({ onFechar }) {
  const navigate = useNavigate();
  const [sessoes, setSessoes] = useState(null);
  const [aparelhos, setAparelhos] = useState([]);
  const [digitosPin, setDigitosPin] = useState(6);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    fetchSessions()
      .then((r) => {
        if (!ativo) return;
        setSessoes(r.sessoes || []);
        setAparelhos(r.aparelhos || []);
        setDigitosPin(r.digitosPin || 6);
        setErro('');
      })
      .catch((e) => {
        if (!ativo) return;
        if (e.status === 401) navigate('/login', { replace: true });
        else setErro(e.message);
      });
    return () => { ativo = false; };
  }, [versao, navigate]);

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onFechar]);

  // Toda ação da aba passa por aqui. Devolve { ok, erro }: o formulário do PIN mostra o erro
  // ao lado dos campos (erroLocal); o resto aparece no aviso do topo.
  const agir = async (corpo, mensagem, { erroLocal = false } = {}) => {
    setOcupado(true);
    setAviso('');
    try {
      const r = await sessionAction(corpo);
      setAviso(mensagem(r || {}));
      setVersao((v) => v + 1);
      return { ok: true };
    } catch (e) {
      if (e.status === 401) {
        navigate('/login', { replace: true });
        return { ok: false, erro: e.message };
      }
      if (!erroLocal) {
        setAviso(e.message);
        setVersao((v) => v + 1);
      }
      return { ok: false, erro: e.message };
    } finally {
      setOcupado(false);
    }
  };

  const grupos = sessoes ? agruparPorPessoa(sessoes) : [];
  const total = sessoes?.length || 0;

  return (
    <div className="central-overlay" role="dialog" aria-modal="true" aria-label="Sessões ativas" onClick={onFechar}>
      <div className="central-painel sessoes-painel" onClick={(e) => e.stopPropagation()}>
        <div className="central-topo">
          <div>
            <h2>Sessões ativas</h2>
            <p>
              Onde o sistema está aberto agora. Encerrar desconecta aquele computador na hora: quem estiver
              lá vai precisar da senha para entrar de novo.
            </p>
          </div>
          <div className="sessoes-topo-acoes">
            <button type="button" className="sessoes-btn-atualizar" disabled={ocupado} onClick={() => { setAviso(''); setVersao((v) => v + 1); }}>
              Atualizar
            </button>
            <button type="button" className="btn-close-modal" onClick={onFechar} title="Fechar">&times;</button>
          </div>
        </div>

        {aviso && <p className="sessoes-aviso" role="status">{aviso}</p>}

        <div className="central-conteudo">
          {erro && <p className="sessoes-erro">{erro}</p>}
          {!erro && !sessoes && <p className="central-vazio">Carregando…</p>}
          {sessoes && (
            <p className="sessoes-resumo">
              {total === 1 ? '1 sessão aberta' : `${total} sessões abertas`} · {grupos.length === 1 ? '1 pessoa' : `${grupos.length} pessoas`}
            </p>
          )}

          {grupos.map((g) => {
            const outras = g.sessoes.filter((s) => !s.atual);
            return (
              <section key={g.chave} className="sessoes-grupo">
                <div className="sessoes-grupo-topo">
                  <h3>
                    {g.pessoa}
                    <small>{g.papel === 'admin' ? 'Painel administrativo' : 'Portal do colaborador'}</small>
                  </h3>
                  {outras.length > 1 && (
                    <BotaoConfirmar
                      rotulo={g.papel === 'admin' ? 'Encerrar as outras' : 'Encerrar todas'}
                      confirmar={`Confirmar: encerrar ${outras.length}`}
                      ocupado={ocupado}
                      onConfirmar={() => agir(
                        { acao: 'encerrar-pessoa', papel: g.papel, usuario: g.usuario },
                        ({ encerradas: n = 0 }) => `${n} ${n === 1 ? 'sessão encerrada' : 'sessões encerradas'} de ${g.pessoa}.`,
                      )}
                    />
                  )}
                </div>

                <ul className="sessoes-lista">
                  {g.sessoes.map((s) => (
                    <li key={s.id} className={`sessoes-item ${s.atual ? 'atual' : ''}`}>
                      <div className="sessoes-item-info">
                        <strong>
                          {rotuloAparelho(s)}
                          {s.atual && <span className="sessoes-selo">Este computador</span>}
                        </strong>
                        <span>
                          Entrou {quando(s.entrouEm)}
                          {s.usoEm !== s.entrouEm && <> · usado {quando(s.usoEm)}</>}
                        </span>
                        {/* Com "manter conectado" o prazo anda a cada dia de uso; sem, são 8h do login. */}
                        <span className="sessoes-prazo">
                          {s.lembrar
                            ? `Manter conectado · cai ${quando(s.expiraEm)} se não for usado`
                            : `Até fechar o navegador · cai ${quando(s.expiraEm)}`}
                        </span>
                      </div>
                      {s.atual ? (
                        <span className="sessoes-dica">Para sair daqui, use "Sair do Sistema".</span>
                      ) : (
                        <BotaoConfirmar
                          rotulo="Encerrar"
                          confirmar="Confirmar"
                          ocupado={ocupado}
                          onConfirmar={() => agir(
                            { acao: 'encerrar', id: s.id },
                            () => `Sessão encerrada: ${rotuloAparelho(s)} de ${g.pessoa}.`,
                          )}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {sessoes && <Computadores aparelhos={aparelhos} digitosPin={digitosPin} ocupado={ocupado} agir={agir} />}
        </div>
      </div>
    </div>
  );
}
