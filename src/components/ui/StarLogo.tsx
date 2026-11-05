import React from 'react';

export function StarLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 2 C16 2 17.5 10 24 16 C17.5 22 16 30 16 30 C16 30 14.5 22 8 16 C14.5 10 16 2 16 2Z" />
      <path d="M2 16 C2 16 10 14.5 16 8 C22 14.5 30 16 30 16 C30 16 22 17.5 16 24 C10 17.5 2 16 2 16Z" />
    </svg>
  );
}
