import { getAvatarColorScheme, getInitials } from '../../utils/avatarColors';

interface AvatarProps {
  name: string | undefined | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'gradient' | 'solid';
  className?: string;
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[8px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

/**
 * Avatar component with color coding based on name prefix
 * - Za => pink/red
 * - Sa => green/yellow  
 * - Ma => blue
 * - Mu => orange
 */
export function Avatar({ 
  name, 
  avatarUrl, 
  size = 'md', 
  variant = 'gradient',
  className = '' 
}: AvatarProps) {
  const colorScheme = getAvatarColorScheme(name);
  const initials = getInitials(name);
  const sizeClass = sizeClasses[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'User'}
        className={`${sizeClass.split(' ').slice(0, 2).join(' ')} rounded-full object-cover ${className}`}
      />
    );
  }

  const bgClass = variant === 'gradient' ? colorScheme.gradient : colorScheme.bg;
  const textClass = variant === 'gradient' ? 'text-white' : colorScheme.text;

  return (
    <div 
      className={`${sizeClass} rounded-full ${bgClass} flex items-center justify-center ${className}`}
    >
      <span className={`${textClass} font-semibold`}>
        {initials}
      </span>
    </div>
  );
}
