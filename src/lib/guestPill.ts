import type { Guest } from "@/types";

/** Returns Tailwind classes for a guest chip: gray for regular cast, soft red for special guests. */
export function guestPillClasses(guest: Guest): string {
  return guest.castType === "regular_cast"
    ? "bg-slate-100 text-slate-700"
    : "bg-rose-100 text-rose-700";
}
