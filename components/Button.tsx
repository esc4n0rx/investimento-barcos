// components/Button.tsx
import React from 'react';

interface ButtonProps {
  type: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ type, disabled, children }) => {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-300 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {children}
    </button>
  );
};

export default Button;
