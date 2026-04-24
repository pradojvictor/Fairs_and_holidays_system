// Arquivo: src/components/RestScreen.jsx
import React, { useState, useEffect } from 'react';
import './index.css';

export default function RestScreen({ isActive, onWakeUp }) {
  const [time, setTime] = useState(new Date());

  // Faz o relógio rodar apenas quando a tela estiver ativa
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div className={`rest-screen-overlay ${isActive ? 'active' : ''}`}>
      <h1 className="rest-clock">
        {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </h1>
      <p className="rest-subtitle">Sistema em Pausa</p>
      
      <button className="btn-return-work" onClick={onWakeUp}>
        Voltar ao Trabalho
      </button>
    </div>
  );
}