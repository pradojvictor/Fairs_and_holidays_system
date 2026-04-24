// Arquivo: src/components/RestScreen.jsx
import React, { useState, useEffect } from 'react';
import './index.css'; // Ou o arquivo CSS que você usa para essa tela

// MÁGICA: Traduz o código numérico da API para texto e emoji
const getWeatherCodeInfo = (code) => {
  if (code === 0) return { desc: 'Céu Limpo', icon: '☀️' };
  if (code === 1 || code === 2 || code === 3) return { desc: 'Parcialmente Nublado', icon: '⛅' };
  if (code >= 45 && code <= 48) return { desc: 'Neblina', icon: '🌫️' };
  if (code >= 51 && code <= 55) return { desc: 'Garoa', icon: '🌧️' };
  if (code >= 61 && code <= 65) return { desc: 'Chuva', icon: '🌧️' };
  if (code >= 71 && code <= 75) return { desc: 'Neve', icon: '❄️' }; // Pouco provável, mas garantido!
  if (code >= 80 && code <= 82) return { desc: 'Pancadas de Chuva', icon: '🌦️' };
  if (code >= 95 && code <= 99) return { desc: 'Tempestade', icon: '⛈️' };
  return { desc: 'Tempo Instável', icon: '🌡️' };
};

export default function RestScreen({ isActive, onWakeUp }) {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState(null);

  // 1. Faz o relógio rodar apenas quando a tela estiver ativa
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isActive]);

  // 2. Busca os dados climáticos da API
  useEffect(() => {
    if (!isActive) return; // Só busca se a tela de descanso abriu

    const fetchWeather = async () => {
      try {
        // Coordenadas de Teresina
        const lat = -5.0892;
        const lon = -42.8016;
        
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        
        const current = data.current_weather;
        const info = getWeatherCodeInfo(current.weathercode);
        
        setWeather({
          temp: Math.round(current.temperature),
          desc: info.desc,
          icon: info.icon
        });
      } catch (err) {
        console.error('Erro ao buscar o clima:', err);
      }
    };

    fetchWeather(); // Busca na hora que a tela abre
    
    // Atualiza o clima a cada 30 minutos caso o sistema fique pausado por muito tempo
    const weatherInterval = setInterval(fetchWeather, 30 * 60 * 1000);
    
    return () => clearInterval(weatherInterval);
  }, [isActive]);

  return (
    <div className={`rest-screen-overlay ${isActive ? 'active' : ''}`}>
      <h1 className="rest-clock">
        {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </h1>   
      {/* NOVO: Widget Flutuante do Clima */}
      {weather && (
        <div className="weather-widget">
          <span className="weather-icon">{weather.icon}</span>
          <span className="weather-temp">{weather.temp}°C</span>
          <span className="weather-desc">Teresina • {weather.desc}</span>
        </div>
      )}
      
      <button className="btn-return-work" onClick={onWakeUp}>
        Voltar ao Trabalho
      </button>
    </div>
  );
}