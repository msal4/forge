// ============================================
// Loading Indicator Component
// Consistent Mesopotamian-themed loading symbol
// ============================================

interface LoadingIndicatorProps {
  /** Size variant: xs, sm, md, lg, xl */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Custom color class (e.g., "text-lapis-500", "text-stone-400") */
  className?: string;
  /** Whether to show inline (no flex container) */
  inline?: boolean;
}

const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

export function LoadingIndicator({ 
  size = 'md', 
  className = 'text-lapis-500',
  inline = false,
}: LoadingIndicatorProps) {
  const symbol = <span className={`animate-pulse ${sizeClasses[size]} ${className}`}>𒀭</span>;
  
  if (inline) {
    return symbol;
  }
  
  return (
    <div className="flex items-center justify-center">
      {symbol}
    </div>
  );
}
