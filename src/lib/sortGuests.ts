import type { Guest } from "@/types";

// Hand-pinned guests that float to the top of any dropdown, in this exact
// order. Match is `includes` so e.g. "大物" still picks up "大物是也".
// Edit this list to reorder or add/remove names.
export const PRIORITY_NAMES: readonly string[] = [
  "大物",
  "大白牛",
  "王阿姨",
  "斑马酱",
  "小博",
  "小龙",
  "惑",
  "成哥",
  "货货",
];

function priorityRank(name: string): number {
  const idx = PRIORITY_NAMES.findIndex((p) => name.includes(p));
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

/**
 * Sort guests for display in dropdowns:
 *   1. Hand-pinned priority names (in PRIORITY_NAMES order)
 *   2. Regular cast, alphabetically
 *   3. Special guests, alphabetically
 */
export function sortGuests(guests: Guest[]): Guest[] {
  return [...guests].sort((a, b) => {
    const ra = priorityRank(a.name);
    const rb = priorityRank(b.name);
    if (ra !== rb) return ra - rb;
    // For unpinned guests, regular_cast before special_guest.
    if (ra === Number.POSITIVE_INFINITY) {
      const ca = a.castType === "regular_cast" ? 0 : 1;
      const cb = b.castType === "regular_cast" ? 0 : 1;
      if (ca !== cb) return ca - cb;
    }
    return a.name.localeCompare(b.name, "zh-Hans");
  });
}
