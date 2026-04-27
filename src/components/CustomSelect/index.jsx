// Arquivo: src/components/CustomSelect.jsx
import React, { useState, useRef, useEffect } from 'react';
import './index.css';

export default function CustomSelect({ 
  label, 
  options = [], 
  value, 
  onChange, 
  placeholder = '-- Selecione --',
  variant = 'text',
  customThemeClass = '' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const renderTriggerContent = () => {
    if (variant === 'color') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="color-swatch-preview" style={{ backgroundColor: value }}></div>
          <span style={{ fontSize: '0.9rem', color: 'white' }}>{value}</span>
        </div>
      );
    }
    const selectedOption = options.find(opt => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : placeholder;
    return (
      <span className="custom-dropdown-value" style={{ color: value ? 'white' : 'gray' }}>
        {displayLabel}
      </span>
    );
  };
  return (
    <div className={`custom-select-wrapper ${customThemeClass}`} ref={dropdownRef}>
      {label && <label className="custom-select-label">{label}</label>}

      <div className="custom-dropdown-container">
        <div 
          className={`custom-dropdown-trigger ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {renderTriggerContent()}
          <span className="custom-dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
        </div>

        {isOpen && (
          <div className="custom-dropdown-menu">
            {variant === 'color' ? (
              <div className="color-palette">
                {options.map(c => (
                  <div
                    key={c}
                    className={`color-swatch ${value === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => { onChange(c); setIsOpen(false); }}
                    title={c}
                  />
                ))}
              </div>
            ) : (
              <ul className="custom-dropdown-list">
                <li 
                  className={`custom-dropdown-option ${!value ? 'selected' : ''}`}
                  onClick={() => { onChange(''); setIsOpen(false); }}
                >
                  {placeholder}
                </li>
                {options.map((opt) => (
                  <li 
                    key={opt.value}
                    className={`custom-dropdown-option ${value === opt.value ? 'selected' : ''}`}
                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  >
                    {opt.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}