"use client";

import React from "react";
import { User } from "lucide-react";

interface AvatarInitialsProps {
  firstName: string;
  size?: number; // diameter in pixels, default 96
  className?: string;
}

const AVATAR_COLORS = [
  '#E57373', // Red
  '#F06292', // Pink
  '#BA68C8', // Purple
  '#9575CD', // Deep Purple
  '#7986CB', // Indigo
  '#64B5F6', // Blue
  '#4FC3F7', // Light Blue
  '#4DD0E1', // Cyan
  '#4DB6AC', // Teal
  '#81C784', // Green
];

function getColorFromName(name: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function AvatarInitials({ firstName, size = 96, className = '' }: AvatarInitialsProps) {
  if (!firstName || firstName.trim() === '') {
    return <User className="w-10 h-10 text-text-secondary" />;
  }
  
  const initial = firstName.charAt(0).toUpperCase();
  const backgroundColor = getColorFromName(firstName);
  const fontSize = Math.floor(size * 0.375); // 36px for 96px diameter
  
  return (
    <div
      className={`rounded-full flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor,
        color: 'white',
        fontSize: `${fontSize}px`,
        fontWeight: 600,
      }}
    >
      {initial}
    </div>
  );
}
