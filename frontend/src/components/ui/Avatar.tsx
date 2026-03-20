import React from 'react';
import { clsx } from 'clsx';

interface AvatarProps {
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  src?: string;
  alt?: string;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#d946ef',
];

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ name, color, size = 'md', className = '', src, alt }: AvatarProps) {
  const avatarColor = color || getColorFromName(name);
  const initials = getInitials(name);

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name}
        className={clsx('rounded-full object-cover', SIZE_CLASSES[size], className)}
      />
    );
  }

  return (
    <div
      className={clsx(
        'inline-flex items-center justify-center font-semibold text-white rounded-full select-none',
        SIZE_CLASSES[size],
        className
      )}
      style={{ backgroundColor: avatarColor }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}