import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-canvas disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-soft focus:ring-primary shadow-lg shadow-primary-deep/20",
    secondary: "bg-surface-highlight text-ink hover:bg-surface-highlight/80 focus:ring-surface-highlight border border-surface-highlight",
    danger: "bg-danger text-white hover:bg-danger-soft focus:ring-danger",
    ghost: "bg-transparent text-primary-soft hover:text-primary-soft hover:bg-white/5",
    soft: "bg-primary/10 text-primary-soft hover:bg-primary/20 border border-primary/20 shadow-none",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};