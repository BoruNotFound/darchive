import type { Guest } from "@/types";

interface AvatarProps {
  guest: Pick<Guest, "id" | "name" | "avatarUrl">;
  size?: number;
  className?: string;
}

// A small palette for the initials-fallback. Index is stable per guest id
// so the same guest always gets the same color.
const FALLBACK_COLORS = [
  "bg-pink-500",
  "bg-purple-500",
  "bg-indigo-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
];

function colorForId(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return FALLBACK_COLORS[sum % FALLBACK_COLORS.length];
}

/**
 * Round avatar with a graceful fallback to initials when no image is set.
 * Default 32px; pass `size` for larger contexts (cards, edit forms).
 */
export function Avatar({ guest, size = 32, className = "" }: AvatarProps) {
  const dim = { width: size, height: size };

  if (guest.avatarUrl) {
    return (
      <img
        src={guest.avatarUrl}
        alt={guest.name}
        loading="lazy"
        style={dim}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  const initial = guest.name.charAt(0).toUpperCase();
  return (
    <div
      style={{ ...dim, fontSize: Math.round(size * 0.42) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorForId(
        guest.id,
      )} ${className}`}
      aria-hidden
    >
      {initial}
    </div>
  );
}
