import { useEffect, useState } from "react";
import Markdown from "react-markdown";

export function AcknowledgementButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-slate-400 underline-offset-2 transition hover:text-slate-700 hover:underline"
      >
        致谢
      </button>
      {open && <MarkdownDialog src="/acknowledgement.md" onClose={() => setOpen(false)} />}
    </>
  );
}

export function CreditsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-slate-400 underline-offset-2 transition hover:text-slate-700 hover:underline"
      >
        制作人员
      </button>
      {open && <MarkdownDialog src="/credits.md" onClose={() => setOpen(false)} />}
    </>
  );
}

export function GuideButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-slate-400 underline-offset-2 transition hover:text-slate-700 hover:underline"
      >
        使用说明
      </button>
      {open && <MarkdownDialog src="/guide.md" onClose={() => setOpen(false)} />}
    </>
  );
}

function MarkdownDialog({ src, onClose }: { src: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}${src}`)
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setContent("（内容加载失败）"));
  }, [src]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          ×
        </button>

        {content === null ? (
          <p className="text-sm text-slate-400">加载中…</p>
        ) : (
          <div className="prose prose-slate prose-sm max-w-none prose-img:rounded-lg prose-img:shadow-sm prose-a:text-pink-600 prose-headings:text-slate-900">
            <Markdown>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
