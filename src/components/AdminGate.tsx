import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLogin } from "./AdminLogin";

/**
 * Three-state guard for admin content:
 *   - loading        → spinner / placeholder
 *   - not signed in  → AdminLogin
 *   - signed in but not in `admins` table → "not authorized" panel
 *   - signed in AND admin → render children
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        加载中…
      </div>
    );
  }

  if (!user) {
    return <AdminLogin />;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-900">无管理员权限</h2>
        <p className="mt-2 text-sm text-amber-800">
          你已经登录为 <strong>{user.email}</strong>,但还没有管理员权限。
          请联系现有管理员把你加入 <code>admins</code> 表。
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-4 text-sm font-medium text-amber-900 underline-offset-2 hover:underline"
        >
          退出登录
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
