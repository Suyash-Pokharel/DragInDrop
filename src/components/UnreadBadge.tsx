"use client";

interface UnreadBadgeProps {
  count: number;
}

export default function UnreadBadge({ count }: UnreadBadgeProps) {
  // Hide badge if count is 0
  if (count === 0) {
    return null;
  }

  // Render red badge if count > 0
  return (
    <span
      className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error border border-surface"
      aria-label={`${count} unread notification${count !== 1 ? "s" : ""}`}
    />
  );
}
