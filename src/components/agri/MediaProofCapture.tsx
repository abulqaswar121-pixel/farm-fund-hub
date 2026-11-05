import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, ImageUp, Loader2, Trash2, Video } from "lucide-react";
import { useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { attachLogProof } from "@/lib/agri.community.functions";
import { cn } from "@/lib/utils";

/**
 * Photo and video proof from the phone's own camera.
 *
 * A farm worker finishing a log at six in the morning should not have to find a
 * file, resize it and paste a URL. The inputs below carry `capture="environment"`
 * so a phone opens the rear camera straight away, and both accept a normal
 * gallery pick as well — because sometimes the proof was taken earlier.
 *
 * Where the file goes: the `farm-proof` Supabase Storage bucket, under a path
 * the storage policy pins to the uploader's own id. If that bucket has not been
 * created on this deployment, or the upload is refused, the component says so
 * plainly and falls back to a pasted link — it never pretends a file was saved.
 */
const BUCKET = "farm-proof";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // 40 MB, a short clip not a film

type Capture = {
  kind: "photo" | "video";
  url: string;
  label: string;
};

export function MediaProofCapture({
  cycleId,
  logId,
  onAttached,
}: {
  cycleId: string;
  logId: string | null;
  onAttached?: () => void;
}) {
  const attach = useServerFn(attachLogProof);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const [captures, setCaptures] = useState<Capture[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(
    null,
  );
  const [linkFallback, setLinkFallback] = useState<{ kind: "photo" | "video"; url: string }>({
    kind: "photo",
    url: "",
  });

  async function handleFile(file: File, kind: "photo" | "video") {
    const limit = kind === "photo" ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
    if (file.size > limit) {
      setMessage({
        tone: "error",
        text:
          kind === "photo"
            ? "That photo is over 8 MB. Take another one — the camera app usually stores a smaller copy."
            : "That clip is over 40 MB. Record a shorter one, or attach a photo instead.",
      });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const extension =
        file.name.split(".").pop()?.toLowerCase() ?? (kind === "photo" ? "jpg" : "mp4");
      const { data: session } = await supabase.auth.getUser();
      const owner = session.user?.id ?? "unknown";
      const path = `${owner}/${cycleId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

      if (uploadError) {
        // The honest path: the bucket may not exist on this deployment yet.
        setMessage({
          tone: "warn",
          text: "This deployment has no photo storage bucket yet, so the file was not uploaded. Paste a link below instead, or ask the admin to create the 'farm-proof' bucket.",
        });
        setBusy(false);
        return;
      }

      const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await attach({
        data: {
          cycleId,
          logId,
          kind,
          url: publicUrl.publicUrl,
          caption: kind === "photo" ? "Farm proof photo" : "Farm proof clip",
        },
      });

      setCaptures((prev) => [
        ...prev,
        { kind, url: publicUrl.publicUrl, label: file.name || `${kind} proof` },
      ]);
      setMessage({
        tone: "ok",
        text: `${kind === "photo" ? "Photo" : "Clip"} attached to this log.`,
      });
      onAttached?.();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "That proof could not be attached",
      });
    }
    setBusy(false);
  }

  async function attachLink() {
    if (!/^https?:\/\//.test(linkFallback.url)) {
      setMessage({ tone: "error", text: "Paste a full link starting with https://" });
      return;
    }
    setBusy(true);
    try {
      await attach({
        data: { cycleId, logId, kind: linkFallback.kind, url: linkFallback.url },
      });
      setCaptures((prev) => [
        ...prev,
        { kind: linkFallback.kind, url: linkFallback.url, label: "Linked proof" },
      ]);
      setLinkFallback({ kind: "photo", url: "" });
      setMessage({ tone: "ok", text: "Link attached to this log." });
      onAttached?.();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "That link could not be attached",
      });
    }
    setBusy(false);
  }

  return (
    <div className="min-w-0">
      <p className="pg-label">Photo & video proof</p>

      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => photoInput.current?.click()}
          disabled={busy}
          className="flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-hairline bg-white px-2 py-3 text-[0.74rem] font-semibold text-ink-deep transition-colors hover:border-signal disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin text-ink-mute" />
          ) : (
            <Camera size={18} className="text-signal-deep" aria-hidden="true" />
          )}
          Take or pick a photo
        </button>
        <button
          type="button"
          onClick={() => videoInput.current?.click()}
          disabled={busy}
          className="flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-hairline bg-white px-2 py-3 text-[0.74rem] font-semibold text-ink-deep transition-colors hover:border-signal disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin text-ink-mute" />
          ) : (
            <Video size={18} className="text-iris" aria-hidden="true" />
          )}
          Record a short clip
        </button>
      </div>

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file, "photo");
          event.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file, "video");
          event.target.value = "";
        }}
      />

      {message ? (
        <p
          className={cn(
            "mt-2 rounded-lg border px-2.5 py-2 text-[0.7rem] leading-5",
            message.tone === "ok"
              ? "border-mint/35 bg-mint-soft text-mint-deep"
              : message.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-rose-200 bg-rose-50 text-rose-700",
          )}
        >
          {message.text}
        </p>
      ) : null}

      {captures.length > 0 ? (
        <ul className="mt-2 m-0 list-none space-y-1.5 p-0">
          {captures.map((item) => (
            <li
              key={item.url}
              className="flex items-center gap-2 rounded-lg border border-mint/30 bg-white px-2.5 py-1.5 text-[0.7rem]"
            >
              <Check size={12} className="shrink-0 text-mint-deep" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-ink-soft">
                {item.kind === "photo" ? "Photo" : "Clip"} · {item.label}
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 font-semibold text-signal-deep no-underline"
              >
                view
              </a>
              <button
                type="button"
                aria-label="Forget this preview"
                onClick={() => setCaptures((prev) => prev.filter((row) => row.url !== item.url))}
                className="shrink-0 text-ink-mute hover:text-rose-600"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* The fallback path, always visible, never hidden behind a failure. */}
      <details className="mt-2">
        <summary className="cursor-pointer text-[0.68rem] font-medium text-ink-mute">
          <ImageUp size={11} className="mr-1 inline" aria-hidden="true" />
          Attach a link instead
        </summary>
        <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row">
          <select
            className="pg-input h-10 sm:w-28"
            value={linkFallback.kind}
            onChange={(event) =>
              setLinkFallback((prev) => ({
                ...prev,
                kind: event.target.value as "photo" | "video",
              }))
            }
          >
            <option value="photo">Photo</option>
            <option value="video">Video</option>
          </select>
          <input
            className="pg-input h-10 min-w-0 flex-1"
            value={linkFallback.url}
            onChange={(event) => setLinkFallback((prev) => ({ ...prev, url: event.target.value }))}
            placeholder="https://…"
            inputMode="url"
          />
          <button
            type="button"
            onClick={() => void attachLink()}
            disabled={busy}
            className="pg-btn pg-btn--ghost h-10 shrink-0 text-[0.74rem]"
          >
            Attach
          </button>
        </div>
      </details>

      <p className="mt-1.5 text-[0.64rem] leading-4 text-ink-mute">
        Photos are checked by an admin before they appear on the public feed. Members backing this
        cycle see the proof on their dashboard straight away.
      </p>
    </div>
  );
}
