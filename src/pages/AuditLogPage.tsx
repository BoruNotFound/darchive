import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminGate } from "@/components/AdminGate";
import { AuditEntry } from "@/components/AuditEntry";
import { listAuditEntries } from "@/lib/db";
import type { AuditAction, AuditLogEntry } from "@/types";

const ACTION_OPTIONS: { value: "all" | AuditAction; label: string }[] = [
  { value: "all", label: "全部操作" },
  { value: "create", label: "创建" },
  { value: "update", label: "修改" },
  { value: "delete", label: "删除" },
];

export function AuditLogPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">操作日志</h1>
            <p className="text-sm text-slate-500">
              谁在什么时候改了什么。每次视频的新增 / 修改 / 删除都会自动记录。
            </p>
          </div>
          <Link
            to="/admin"
            className="text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            ← 管理员首页
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <AdminGate>
          <AuditLogList />
        </AdminGate>
      </main>
    </>
  );
}

function AuditLogList() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState<"all" | AuditAction>("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listAuditEntries(200);
        if (!cancelled) setEntries(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const adminOptions = useMemo(() => {
    const set = new Set(entries.map((e) => e.adminEmail));
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (adminFilter !== "all" && e.adminEmail !== adminFilter) return false;
      return true;
    });
  }, [entries, actionFilter, adminFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as typeof actionFilter)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={adminFilter}
          onChange={(e) => setAdminFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
        >
          <option value="all">全部管理员</option>
          {adminOptions.map((email) => (
            <option key={email} value={email}>
              {email}
            </option>
          ))}
        </select>

        <span className="ml-auto text-sm text-slate-500">
          {loading ? "加载中…" : `共 ${filtered.length} 条 / ${entries.length} 条`}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong className="font-semibold">出错了:</strong> {error}
        </div>
      )}

      {filtered.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
          没有匹配的记录。
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <AuditEntry key={e.id} entry={e} />
          ))}
        </div>
      )}

      {entries.length === 200 && (
        <p className="text-xs text-slate-400">
          只展示最近 200 条。如果需要更早的记录,告诉我加分页。
        </p>
      )}
    </div>
  );
}
