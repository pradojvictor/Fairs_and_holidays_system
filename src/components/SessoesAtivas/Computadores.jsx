// "Computadores do painel", na aba Sessões ativas: cada computador onde o administrador já
// entrou com a senha, com o nome que ele der e o PIN para entrar mais rápido. O PIN só vale no
// computador onde foi criado (ver api/_lib/aparelho.js).
import { useState } from 'react';
import BotaoConfirmar from './BotaoConfirmar';

const fuso = { timeZone: 'America/Fortaleza' };
const dia = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { ...fuso, day: '2-digit', month: '2-digit' }) : '—');
const diaComAno = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', fuso) : '—');

function FormNome({ inicial, ocupado, onSalvar, onCancelar }) {
  const [nome, setNome] = useState(inicial || '');
  return (
    <form className="computador-form" onSubmit={(e) => { e.preventDefault(); onSalvar(nome.trim()); }}>
      <input
        className="computador-input"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={40}
        placeholder="Ex.: Recepção, Coordenação"
        autoFocus
      />
      <button type="submit" className="computador-btn primario" disabled={ocupado}>Salvar</button>
      <button type="button" className="computador-btn" onClick={onCancelar}>Cancelar</button>
    </form>
  );
}

function FormPin({ digitos, ocupado, onSalvar, onCancelar }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [pin, setPin] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const soNumeros = (v) => v.replace(/\D/g, '').slice(0, digitos);

  const enviar = async (e) => {
    e.preventDefault();
    if (pin.length !== digitos) return setErro(`O PIN tem ${digitos} números.`);
    if (pin !== confirmacao) return setErro('Os dois PINs não são iguais.');
    setErro('');
    const falha = await onSalvar({ senhaAtual, pin });
    if (falha) setErro(falha);
  };

  return (
    <form className="computador-form coluna" onSubmit={enviar}>
      <p className="computador-explica">
        O PIN vale só neste computador. Cinco erros seguidos apagam o PIN, e aí só a senha entra.
        Ele vence em 90 dias, e trocar a senha do painel apaga todos os PINs.
      </p>
      <input className="computador-input" type="password" autoComplete="current-password" value={senhaAtual}
        onChange={(e) => setSenhaAtual(e.target.value)} placeholder="Sua senha atual" required />
      <div className="computador-linha">
        <input className="computador-input pin" type="password" inputMode="numeric" autoComplete="off" value={pin}
          onChange={(e) => setPin(soNumeros(e.target.value))} placeholder={`PIN (${digitos} números)`} required />
        <input className="computador-input pin" type="password" inputMode="numeric" autoComplete="off" value={confirmacao}
          onChange={(e) => setConfirmacao(soNumeros(e.target.value))} placeholder="Repita o PIN" required />
      </div>
      {erro && <p className="computador-erro">{erro}</p>}
      <div className="computador-linha">
        <button type="submit" className="computador-btn primario" disabled={ocupado}>Salvar PIN</button>
        <button type="button" className="computador-btn" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function situacaoPin(a) {
  if (a.pin) return { texto: `PIN ativo · vale até ${diaComAno(a.pinValeAte)}`, classe: 'ativo' };
  if (a.pinValeAte) return { texto: 'PIN vencido: entre com a senha e crie de novo', classe: 'aviso' };
  if (a.pinBloqueadoEm) return { texto: `PIN apagado depois de 5 erros (${dia(a.pinBloqueadoEm)})`, classe: 'aviso' };
  return { texto: 'Sem PIN', classe: '' };
}

export default function Computadores({ aparelhos, digitosPin = 6, ocupado, agir }) {
  const [editandoNome, setEditandoNome] = useState(null);
  const [criandoPin, setCriandoPin] = useState(false);
  const esteNaLista = aparelhos.some((a) => a.atual);

  const salvarNome = async (alvo, nome) => {
    const r = await agir({ acao: 'nomear', aparelho: alvo, nome }, () => (nome ? `Computador agora se chama "${nome}".` : 'Nome removido.'));
    if (r.ok) setEditandoNome(null);
  };
  const salvarPin = async ({ senhaAtual, pin }) => {
    const r = await agir({ acao: 'definir-pin', senhaAtual, pin }, () => 'PIN criado. Na próxima entrada neste computador, a tela pede o PIN.', { erroLocal: true });
    if (r.ok) setCriandoPin(false);
    return r.ok ? '' : r.erro;
  };

  const blocoDeste = (a) => (
    <div className="computador-acoes">
      {editandoNome === (a?.id || 'este') ? (
        <FormNome inicial={a?.nome} ocupado={ocupado} onSalvar={(nome) => salvarNome(a?.id || 'este', nome)} onCancelar={() => setEditandoNome(null)} />
      ) : (
        <button type="button" className="computador-btn" onClick={() => setEditandoNome(a?.id || 'este')}>
          {a?.nome ? 'Renomear' : 'Dar nome'}
        </button>
      )}
      {criandoPin ? (
        <FormPin digitos={digitosPin} ocupado={ocupado} onSalvar={salvarPin} onCancelar={() => setCriandoPin(false)} />
      ) : (
        <button type="button" className="computador-btn" onClick={() => setCriandoPin(true)}>
          {a?.pin ? 'Trocar PIN' : 'Criar PIN'}
        </button>
      )}
    </div>
  );

  return (
    <section className="sessoes-grupo computadores">
      <div className="sessoes-grupo-topo">
        <h3>
          Computadores do painel
          <small>Onde o administrador já entrou com a senha. Dê um nome para reconhecer cada um e crie um PIN para entrar mais rápido.</small>
        </h3>
      </div>

      <ul className="sessoes-lista">
        {!esteNaLista && (
          <li className="sessoes-item atual coluna">
            <div className="sessoes-item-info">
              <strong>Sem nome <span className="sessoes-selo">Este computador</span></strong>
              <span>Ainda sem nome e sem PIN.</span>
            </div>
            {blocoDeste(null)}
          </li>
        )}

        {aparelhos.map((a) => {
          const pin = situacaoPin(a);
          return (
            <li key={a.id} className={`sessoes-item coluna ${a.atual ? 'atual' : ''}`}>
              <div className="computador-topo">
                <div className="sessoes-item-info">
                  <strong>
                    {a.nome || 'Sem nome'}
                    {a.atual && <span className="sessoes-selo">Este computador</span>}
                  </strong>
                  <span>
                    {a.descricao || 'Aparelho não identificado'}
                    {a.senhaEm ? ` · senha usada aqui em ${dia(a.senhaEm)}` : ' · a senha ainda não foi usada aqui'}
                    {` · usado ${dia(a.usoEm)}`}
                  </span>
                  <span className={`computador-pin ${pin.classe}`}>{pin.texto}</span>
                </div>
                <div className="computador-botoes">
                  {a.pinValeAte && (
                    <BotaoConfirmar rotulo="Remover PIN" confirmar="Confirmar" ocupado={ocupado}
                      onConfirmar={() => agir({ acao: 'remover-pin', aparelho: a.id }, () => `PIN removido de ${a.nome || 'o computador'}.`)} />
                  )}
                  <BotaoConfirmar rotulo="Esquecer" confirmar="Confirmar: esquecer" ocupado={ocupado}
                    onConfirmar={() => agir({ acao: 'esquecer', aparelho: a.id }, (r) => `${a.nome || 'Computador'} esquecido${r.encerradas ? `; ${r.encerradas} ${r.encerradas === 1 ? 'sessão encerrada' : 'sessões encerradas'}` : ''}.`)} />
                </div>
              </div>
              {a.atual ? blocoDeste(a) : editandoNome === a.id ? (
                <FormNome inicial={a.nome} ocupado={ocupado} onSalvar={(nome) => salvarNome(a.id, nome)} onCancelar={() => setEditandoNome(null)} />
              ) : (
                <div className="computador-acoes">
                  <button type="button" className="computador-btn" onClick={() => setEditandoNome(a.id)}>{a.nome ? 'Renomear' : 'Dar nome'}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
