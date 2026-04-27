// Helpers for turning the raw `audit_log.diff` jsonb payload (written by the
// SECURITY DEFINER trigger on `videos`) into a friendly UI representation.
//
// The trigger stores three diff shapes:
//   - create: the full new row as JSON
//   - delete: the full old row as JSON
//   - update: { before: <old row>, after: <new row> }

import type { AuditAction } from "@/types";

/** Friendly Chinese labels for video columns we surface in the UI. */
const FIELD_LABELS: Record<string, string> = {
  title: "标题",
  bilibili_url: "bilibili 链接",
  published_at: "发布日期",
  duration_sec: "时长",
  thumbnail_url: "封面",
};

export interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

/**
 * Project a raw diff payload into a list of human-meaningful field changes.
 * Fields not in FIELD_LABELS (e.g. created_at, updated_at) are filtered out
 * so we don't leak DB plumbing into the UI.
 */
export function diffToChanges(
  action: AuditAction,
  diff: unknown,
): FieldChange[] {
  if (!diff || typeof diff !== "object") return [];
  const d = diff as Record<string, unknown>;

  if (action === "create") {
    return Object.entries(d)
      .filter(([k]) => k in FIELD_LABELS)
      .map(([k, v]) => ({
        field: k,
        label: FIELD_LABELS[k],
        before: undefined,
        after: v,
      }));
  }

  if (action === "delete") {
    return Object.entries(d)
      .filter(([k]) => k in FIELD_LABELS)
      .map(([k, v]) => ({
        field: k,
        label: FIELD_LABELS[k],
        before: v,
        after: undefined,
      }));
  }

  // update
  const before = (d.before as Record<string, unknown> | undefined) ?? {};
  const after = (d.after as Record<string, unknown> | undefined) ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys)
    .filter((k) => k in FIELD_LABELS)
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({
      field: k,
      label: FIELD_LABELS[k],
      before: before[k],
      after: after[k],
    }));
}

/** Pull a "snapshot title" from the diff so we can show it in the UI even
 *  if the video has since been deleted. */
export function titleFromDiff(action: AuditAction, diff: unknown): string | null {
  if (!diff || typeof diff !== "object") return null;
  const d = diff as Record<string, unknown>;
  if (action === "create" || action === "delete") {
    return typeof d.title === "string" ? d.title : null;
  }
  const after = d.after as Record<string, unknown> | undefined;
  const before = d.before as Record<string, unknown> | undefined;
  const t = after?.title ?? before?.title;
  return typeof t === "string" ? t : null;
}

/**
 * Display a value friendly to humans:
 *   - duration_sec → "12 分钟"
 *   - thumbnail_url → "(图片)" — the URL itself is noisy and unhelpful
 *   - null/undefined → "(空)"
 */
export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "(空)";
  if (field === "duration_sec" && typeof value === "number") {
    return `${Math.round(value / 60)} 分钟`;
  }
  if (field === "thumbnail_url" && typeof value === "string") {
    return "(图片)";
  }
  return String(value);
}

/** Compact "X 分钟前" / "刚刚" / "3 天前" / fallback to date for older. */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 30) return "刚刚";
  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return date.toLocaleDateString("zh-CN");
}
