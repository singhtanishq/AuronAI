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
  xs: 'h-6 w-6 text-[0.6rem]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
};

const AVATAR_COLORS = [
  '15 118 110', // teal
  '5 150 105', // emerald
  '2 132 199', // sky
  '79 70 229', // indigo
  '124 58 237', // violet
  '192 38 211', // fuchsia
  '225 29 72', // rose
  '234 88 12', // orange
  '101 163 13', // lime
];

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

export function Avatar({ name, color, size = 'md', className = '', src, alt }: AvatarProps) {
  const rgb = color ? hexToRgbTriplets(color) : getColorFromName(name);
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
        'inline-flex select-none items-center justify-center rounded-full font-semibold text-white',
        SIZE_CLASSES[size],
        className
      )}
      style={{ backgroundColor: `rgb(${rgb})` }}
      aria-label={alt || name}
      role="img"
    >
      {initials}
    </div>
  );
}

function hexToRgbTriplets(hex: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return getColorFromName('auron');
  return `${parseInt(match[1], 16)} ${parseInt(match[2], 16)} ${parseInt(match[3], 16)}`;
}
