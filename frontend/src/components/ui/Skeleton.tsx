import React from 'react';
import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={clsx('skeleton-shimmer rounded-md', className)}
      style={{
        width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

export function SkeletonMessage({ className = '' }: { className?: string }) {
  return (
    <div className={clsx('flex gap-3', className)}>
      <Skeleton variant="circular" width={32} height={32} className="mt-1 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <Skeleton height={12} width="35%" />
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

export function SkeletonConversationList({ count = 5, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg p-2.5">
          <Skeleton height={12} width={`${55 + ((i * 17) % 35)}%`} className="mb-2" />
          <Skeleton height={10} width={`${70 - ((i * 13) % 30)}%`} />
        </div>
      ))}
    </div>
  );
}
