import { Link } from "react-router-dom";
import { AdminGate } from "@/components/AdminGate";
import { useAuth } from "@/contexts/AuthContext";

export function AdminPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">管理员</h1>
            <p className="text-sm text-slate-500">视频与嘉宾管理</p>
          </div>
          <Link
            to="/"
            className="text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            ← 回到面板
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <AdminGate>
          <AdminHome />
        </AdminGate>
      </main>
    </>
  );
}

function AdminHome() {
  const { user, signOut } = useAuth();
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          已登录为 <strong className="text-slate-900">{user?.email}</strong>
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-2 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          退出登录
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          to="/admin/guests"
          className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-pink-300 hover:shadow-md"
        >
          <div className="text-base font-semibold text-slate-900">
            嘉宾管理
          </div>
          <p className="mt-1 text-sm text-slate-500">
            新增、编辑、删除嘉宾及头像。
          </p>
          <div className="mt-3 text-xs font-medium text-pink-600">
            前往 →
          </div>
        </Link>

        <Link
          to="/admin/videos"
          className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-pink-300 hover:shadow-md"
        >
          <div className="text-base font-semibold text-slate-900">
            视频管理
          </div>
          <p className="mt-1 text-sm text-slate-500">
            粘贴 bilibili 链接,自动获取标题、封面、日期、时长。
          </p>
          <div className="mt-3 text-xs font-medium text-pink-600">
            前往 →
          </div>
        </Link>

        <Link
          to="/admin/videos-missing-guests"
          className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-pink-300 hover:shadow-md md:col-span-2"
        >
          <div className="text-base font-semibold text-slate-900">
            缺少嘉宾名单的视频
          </div>
          <p className="mt-1 text-sm text-slate-500">
            协作工作区 — 列出所有还没有标注嘉宾的视频,逐个补全。
          </p>
          <div className="mt-3 text-xs font-medium text-pink-600">
            前往 →
          </div>
        </Link>

        <Link
          to="/admin/audit-log"
          className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-pink-300 hover:shadow-md md:col-span-2"
        >
          <div className="text-base font-semibold text-slate-900">
            操作日志
          </div>
          <p className="mt-1 text-sm text-slate-500">
            谁在什么时候改了什么。每次视频改动都会自动记录。
          </p>
          <div className="mt-3 text-xs font-medium text-pink-600">
            前往 →
          </div>
        </Link>
      </div>
    </div>
  );
}
