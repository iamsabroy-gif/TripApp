"use client";

import { useRef, useState } from "react";

// FSD §4.6 — direct-to-Cloudinary upload: the backend signs the request
// (POST /api/uploads/sign); the binary goes straight from the browser to
// Cloudinary, and only secure_url + public_id come back into form state.

export interface UploadedImage {
  imageUrl: string;
  cloudPublicId: string;
}

export async function uploadToCloudinary(file: File): Promise<UploadedImage> {
  const signRes = await fetch("/api/uploads/sign", { method: "POST" });
  if (!signRes.ok) {
    const data = await signRes.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to get upload signature");
  }
  const { signature, timestamp, apiKey, cloudName, folder } = await signRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  if (folder) form.append("folder", folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  if (!uploadRes.ok) throw new Error("Image upload failed");
  const data = await uploadRes.json();
  return { imageUrl: data.secure_url, cloudPublicId: data.public_id };
}

interface ImageUploaderProps {
  label?: string;
  multiple?: boolean;
  onUploaded: (images: UploadedImage[]) => void;
}

export function ImageUploader({ label = "Upload images", multiple = true, onUploaded }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: UploadedImage[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadToCloudinary(file));
      }
      onUploaded(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-md border border-dashed border-stone-400 px-3 py-1.5 text-xs text-stone-600 hover:border-forest-500 hover:text-forest-700 disabled:opacity-50"
      >
        {busy ? "Uploading…" : `📷 ${label}`}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
