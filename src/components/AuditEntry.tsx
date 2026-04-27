import {
  diffToChanges,
  formatRelativeTime,
  formatValue,
  titleFromDiff,
} from "@/lib/audit";
import type { AuditAction, AuditLogEntry } from "@/types";

const ACTION_BADGE: Record<AuditAction, { label: string; cls: string }> = {
  create: {
    label: "创建",
    cls: "bg-emerald-100 text-emerald-800",
  },
  update: {
    label: "修改",
    cls: "bg-amber-100 text-amber-800",
  },
  delete: {
    label: "删除",
    cls: "bg-red-100 text-red-800",
  },
};

interface AuditEntryProps {
  entry: AuditLogEntry;
  /** When true, suppress the "video: …" line (e.g. when the parent already
   *  identifies the video, like in the per-video history view). */
  hideVideoLine?: boolean;
}

export function AuditEntry({ entry, hideVideoLine }: AuditEntryProps) {
  const changes = diffToChanges(entry.action, entry.diff);
  const snapshotTitle = titleFromDiff(entry.action, entry.diff);
  const badge = ACTION_BADGE[entry.action];
  const absoluteTime = new Date(entry.occurredAt).toLocaleString("zh-CN");

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-900">
            {entry.adminEmail}
          </div>
          <div className="text-xs text-slate-500" title={absoluteTime}>
            {formatRelativeTime(entry.occurredAt)} · {absoluteTime}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
        >
          {badge.label}
        </span>
      </header>

      {!hideVideoLine && (
        <p className="mt-2 truncate text-sm text-slate-700">
          <span className="text-slate-500">视频:</span>{" "}
          {snapshotTitle ?? entry.videoId}
        </p>
      )}

      {changes.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
          {changes.map((c) => (
            <li key={c.field} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-slate-600">{c.label}</span>
              {entry.action === "update" ? (
                <>
                  <span className="text-slate-400 line-through">
                    {formatValue(c.field, c.before)}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span className="text-slate-800">
                    {formatValue(c.field, c.after)}
                  </span>
                </>
              ) : entry.action === "create" ? (
                <span className="text-slate-800">
                  {formatValue(c.field, c.after)}
                </span>
              ) : (
                <span className="text-slate-500 line-through">
                  {formatValue(c.field, c.before)}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : entry.action === "update" ? (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs italic text-slate-400">
          没有字段变化(可能是嘉宾名单更新)。
        </p>
      ) : null}
    </article>
  );
}
