"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  id: string;
  label: string;
  type?: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
};

export default function TextField({ id, label, type = "text", icon, value, onChange, error, autoComplete, placeholder }: Props) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__box" data-invalid={!!error}>
        {icon}
        <input
          id={id}
          name={id}
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {isPassword && (
          <button type="button" className="field__toggle" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p id={`${id}-error`} className="field__error" role="alert">{error}</p>}
    </div>
  );
}