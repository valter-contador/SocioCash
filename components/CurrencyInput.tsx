
import React, { useEffect, useState } from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  autoFocus?: boolean;
}

const formatFromCents = (cents: number): string =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const centsFromDisplay = (display: string): number => {
  const n = parseFloat((display || '0').replace(/\./g, '').replace(',', '.'));
  return Math.round((isNaN(n) ? 0 : n) * 100);
};

// Máscara monetária BRL: dígitos entram pela direita (formato "milhar,centavos"),
// ex.: digitar 6,0,0,0,0 -> "6,00" -> "60,00" -> "600,00" -> "6.000,00" -> "60.000,00".
const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, className, placeholder, required, id, autoFocus }) => {
  const [display, setDisplay] = useState(() => (value ? formatFromCents(Math.round(value * 100)) : ''));

  // Sincroniza quando o valor externo muda por outro caminho (ex.: atalho "usar saldo devedor").
  useEffect(() => {
    const propCents = Math.round((value || 0) * 100);
    if (propCents !== centsFromDisplay(display)) {
      setDisplay(propCents ? formatFromCents(propCents) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    const cents = digits ? parseInt(digits, 10) : 0;
    setDisplay(cents ? formatFromCents(cents) : '');
    onChange(cents / 100);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      required={required}
      placeholder={placeholder || '0,00'}
      className={className}
      value={display}
      onChange={handleChange}
    />
  );
};

export default CurrencyInput;
