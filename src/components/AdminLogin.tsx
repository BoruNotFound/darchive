import { useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function AdminLogin() {
  const { signInWithEmail, resetAuthState } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败,请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">检查你的邮箱</h2>
        <p className="mt-2 text-sm text-slate-600">
          如果 <strong>{email}</strong> 是已注册的管理员邮箱,我们已经发送了一封登录链接。
          点击邮件里的链接即可登录。
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setEmail("");
          }}
          className="mt-4 text-xs text-slate-500 underline-offset-2 hover:underline"
        >
          换一个邮箱重试
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-900">管理员登录</h2>
      <p className="mt-1 text-sm text-slate-500">
        输入你的邮箱,我们会发送一次性登录链接。
      </p>

      <label
        htmlFor="email"
        className="mt-6 block text-sm font-medium text-slate-700"
      >
        邮箱
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy || !email}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "发送中…" : "发送登录链接"}
      </button>

      <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
        登录卡住或页面无响应?
        <button
          type="button"
          onClick={resetAuthState}
          className="ml-1 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          重置本地登录状态
        </button>
      </p>
    </form>
  );
}
