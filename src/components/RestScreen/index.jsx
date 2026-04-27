import React, { useState, useEffect } from 'react';
import './index.css'; 

const getWeatherCodeInfo = (code) => {
  if (code === 0) return { desc: 'Céu Limpo', icon: '☀️' };
  if (code === 1 || code === 2 || code === 3) return { desc: 'Parcialmente Nublado', icon: '⛅' };
  if (code >= 45 && code <= 48) return { desc: 'Neblina', icon: '🌫️' };
  if (code >= 51 && code <= 55) return { desc: 'Garoa', icon: '🌧️' };
  if (code >= 61 && code <= 65) return { desc: 'Chuva', icon: '🌧️' };
  if (code >= 71 && code <= 75) return { desc: 'Neve', icon: '❄️' };
  if (code >= 80 && code <= 82) return { desc: 'Pancadas de Chuva', icon: '🌦️' };
  if (code >= 95 && code <= 99) return { desc: 'Tempestade', icon: '⛈️' };
  return { desc: 'Tempo Instável', icon: '🌡️' };
};

export default function RestScreen({ isActive, onWakeUp }) {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);
  useEffect(() => {
    if (!isActive) return;

    const fetchWeather = async () => {
      try {
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
    fetchWeather();
    const weatherInterval = setInterval(fetchWeather, 30 * 60 * 1000);
    
    return () => clearInterval(weatherInterval);
  }, [isActive]);
  return (
    <div className={`rest-screen-overlay ${isActive ? 'active' : ''}`}>
      <h1 className="rest-clock">
        {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </h1>   
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