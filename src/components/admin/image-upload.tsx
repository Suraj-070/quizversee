"use client";

import { useState, useRef } from "react";
import { ImagePlus, X, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * ImageUpload — a file picker that uploads an image to /api/admin/upload
 * and returns the base64 data URI. Used in the admin question form for
 * the question image and each option image.
 *
 * When an image is already set, shows a preview with a "Remove" button.
 */
export function ImageUpload({
  value,
  onChange,
  label,
  className,
}: {
  value: string | null;
  onChange: (dataUri: string | null) => void;
  label?: string;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Upload failed");
      }
      const data = (await res.json()) as { dataUri: string };
      onChange(data.dataUri);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-xs font-medium text-slate-600">{label}</label>
      )}
      {value ? (
        <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-2">
          <img
            src={value}
            alt="Preview"
            className="max-h-32 w-auto rounded mx-auto"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1 right-1 size-6 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600 hover:border-red-300 transition-colors"
            aria-label="Remove image"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors flex flex-col items-center gap-1.5"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-emerald-500" />
          ) : (
            <ImagePlus className="size-5 text-slate-400" />
          )}
          <span>
            {uploading ? "Uploading…" : "Click to upload an image"}
          </span>
          <span className="text-[10px] text-slate-400">PNG, JPEG, WebP, GIF, SVG · max 2 MB</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
