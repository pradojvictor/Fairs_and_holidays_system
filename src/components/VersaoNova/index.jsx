// Faixa "versão nova": aparece quando um deploy chega com a página já em uso (ver
// pwa/atualizacao.js). Não recarrega sozinha para não apagar o que estiver sendo preenchido.
import { useEffect, useState } from 'react';
import { EVENTO_VERSAO_NOVA, haVersaoNova } from '../../pwa/atualizacao';
import './index.css';

export default function VersaoNova() {
  const [visivel, setVisivel] = useState(() => haVersaoNova());

  useEffect(() => {
    const mostrar = () => setVisivel(true);
    window.addEventListener(EVENTO_VERSAO_NOVA, mostrar);
    return () => window.removeEventListener(EVENTO_VERSAO_NOVA, mostrar);
  }, []);

  if (!visivel) return null;
  return (
    <div className="versao-nova" role="status">
      <div className="versao-nova-texto">
        <strong>Há uma versão nova do sistema.</strong>
        <span>Termine o que estiver preenchendo e atualize.</span>
      </div>
      <button type="button" className="versao-nova-atualizar" onClick={() => window.location.reload()}>
        Atualizar agora
      </button>
      <button type="button" className="versao-nova-fechar" onClick={() => setVisivel(false)} title="Depois" aria-label="Depois">
        &times;
      </button>
    </div>
  );
}
