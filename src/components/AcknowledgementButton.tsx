import { useEffect, useState } from "react";
import Markdown from "react-markdown";

/**
 * Inline "致谢" link + the dialog it opens. Drop into any page header that
 * wants to surface it. State is local so multiple instances don't collide.
 */
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
      {open && <AcknowledgementDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AcknowledgementDialog({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetch("/acknowledgement.md")
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setContent("（内容加载失败）"));
  }, []);

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
        aria-labelledby="ack-title"
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
