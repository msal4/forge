import { Link } from 'react-router-dom';
import { getAvatarColorScheme, getInitials } from '../../utils/avatarColors';

interface AvatarProps {
  name: string | undefined | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'gradient' | 'solid';
  className?: string;
  /** If provided, avatar becomes a link to the user's profile */
  username?: string | null;
  /** Whether to show hover effect when clickable */
  showHoverEffect?: boolean;
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
 * 
 * Optionally wraps in a Link to the user's profile when username is provided.
 */
export function Avatar({ 
  name, 
  avatarUrl, 
  size = 'md', 
  variant = 'gradient',
  className = '',
  username,
  showHoverEffect = true,
}: AvatarProps) {
  const colorScheme = getAvatarColorScheme(name);
  const initials = getInitials(name);
  const sizeClass = sizeClasses[size];

  const hoverClass = username && showHoverEffect ? 'hover:ring-2 hover:ring-lapis-300 transition-shadow cursor-pointer' : '';

  const avatarElement = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name || 'User'}
      className={`${sizeClass.split(' ').slice(0, 2).join(' ')} rounded-full object-cover ${hoverClass} ${className}`}
    />
  ) : (
    <div 
      className={`${sizeClass} rounded-full ${variant === 'gradient' ? colorScheme.gradient : colorScheme.bg} flex items-center justify-center ${hoverClass} ${className}`}
    >
      <span className={`${variant === 'gradient' ? 'text-white' : colorScheme.text} font-semibold`}>
        {initials}
      </span>
    </div>
  );

  // Wrap in Link if username is provided
  if (username) {
    return (
      <Link 
        to={`/profile/${username}`} 
        onClick={(e) => e.stopPropagation()}
        title={name || 'View profile'}
      >
        {avatarElement}
      </Link>
    );
  }

  return avatarElement;
}
