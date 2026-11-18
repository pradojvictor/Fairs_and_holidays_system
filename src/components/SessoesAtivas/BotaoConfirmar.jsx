// Botão em dois cliques: o primeiro pede confirmação (por 4 segundos), o segundo age.
import { useEffect, useState } from 'react';

export default function BotaoConfirmar({ rotulo, confirmar, ocupado, onConfirmar, className = 'sessoes-btn-encerrar' }) {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return undefined;
    const t = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(t);
  }, [armado]);
  return (
    <button
      type="button"
      className={`${className} ${armado ? 'armado' : ''}`}
      disabled={ocupado}
      onClick={() => {
        if (!armado) return setArmado(true);
        setArmado(false);
        onConfirmar();
      }}
    >
      {armado ? confirmar : rotulo}
    </button>
  );
}
