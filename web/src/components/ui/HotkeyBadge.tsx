import React from 'react';
import { formatShortcut } from '../../hooks/useKeyboard';

// ============================================
// Hotkey Badge - Displays keyboard shortcut hints
// ============================================

interface HotkeyBadgeProps {
  keys: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Displays a keyboard shortcut badge
 * Used on buttons to show their hotkey
 */
export function HotkeyBadge({ keys, className = '', size = 'sm' }: HotkeyBadgeProps) {
  const formatted = formatShortcut(keys);
  
  const sizeClasses = {
    sm: 'text-[10px] px-1 py-0.5 min-w-[18px]',
    md: 'text-xs px-1.5 py-0.5 min-w-[22px]',
  };
  
  return (
    <kbd
      className={`
        inline-flex items-center justify-center
        font-code font-medium
        bg-parchment-300 text-lapis-600
        border border-parchment-400
        rounded
        shadow-inner-glow
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {formatted}
    </kbd>
  );
}

/**
 * Button with integrated hotkey badge
 */
interface ButtonWithHotkeyProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  hotkey?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function ButtonWithHotkey({
  hotkey,
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonWithHotkeyProps) {
  const variantClasses = {
    primary: `
      bg-lapis-500 text-parchment-100 
      hover:bg-lapis-600 
      active:bg-lapis-700
      border border-lapis-600
    `,
    secondary: `
      bg-parchment-200 text-lapis-600
      hover:bg-parchment-300
      active:bg-parchment-400
      border border-parchment-400
    `,
    ghost: `
      bg-transparent text-lapis-600
      hover:bg-parchment-200
      active:bg-parchment-300
    `,
  };
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };
  
  return (
    <button
      className={`
        inline-flex items-center gap-2
        font-body font-medium
        rounded-tablet
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-lapis-400 focus:ring-offset-2 focus:ring-offset-parchment-100
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {children}
      {hotkey && <HotkeyBadge keys={hotkey} />}
    </button>
  );
}
