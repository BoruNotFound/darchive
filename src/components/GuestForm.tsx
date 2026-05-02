import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { uploadGuestAvatar } from "@/lib/storage";
import type { CastType, Guest, GuestInput } from "@/types";

interface GuestFormProps {
  /** Pass an existing guest for edit mode; omit for create. */
  initial?: Guest;
  /** Called after the form's data is collected (parent does the DB write). */
  onSubmit: (input: GuestInput) => Promise<void>;
  onCancel: () => void;
  /** When editing an existing guest, we need its id to scope the avatar path. */
  pendingGuestId?: string;
}

export function GuestForm({
  initial,
  onSubmit,
  onCancel,
  pendingGuestId,
}: GuestFormProps) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  // Default new guests to 常驻嘉宾.
  const [castType, setCastType] = useState<CastType>(
    initial?.castType ?? "regular_cast",
  );
  // null = explicitly cleared, undefined = unchanged
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(
    initial?.avatarUrl,
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewGuest: Pick<Guest, "id" | "name" | "avatarUrl"> = {
    id: initial?.id ?? "preview",
    name: name || "?",
    avatarUrl: avatarUrl ?? undefined,
  };

  async function onPickFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      // We need a guestId to scope the path. For edit we have it; for new
      // guests we pass a temp id from the parent (a stable random id).
      const idForPath = initial?.id ?? pendingGuestId ?? "new";
      const { publicUrl } = await uploadGuestAvatar(idForPath, file);
      setAvatarUrl(publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        id: initial?.id,
        name: name.trim(),
        castType,
        avatarUrl,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h3 className="text-base font-semibold text-slate-900">
        {isEdit ? "编辑嘉宾" : "新增嘉宾"}
      </h3>

      <div className="flex items-center gap-4">
        <Avatar guest={previewGuest} size={56} />
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {uploading ? "上传中…" : avatarUrl ? "更换头像" : "上传头像"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading || submitting}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => setAvatarUrl(null)}
              className="text-left text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              移除头像(显示文字头像)
            </button>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="guest-name"
          className="block text-sm font-medium text-slate-700"
        >
          名字
        </label>
        <input
          id="guest-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
          placeholder="例如:老李"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">类型</label>
        <div className="mt-1 inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setCastType("regular_cast")}
            className={`rounded-md px-3 py-1 transition ${
              castType === "regular_cast"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            常驻嘉宾
          </button>
          <button
            type="button"
            onClick={() => setCastType("special_guest")}
            className={`rounded-md px-3 py-1 transition ${
              castType === "special_guest"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            特邀嘉宾
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting || uploading || !name.trim()}
          className="rounded-lg bg-pink-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "保存中…" : isEdit ? "保存修改" : "添加"}
        </button>
      </div>
    </form>
  );
}
