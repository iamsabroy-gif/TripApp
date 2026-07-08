import crypto from "crypto";

// Cloudinary integration (FSD §4.6): the browser uploads directly to
// Cloudinary using a signature generated here, so large binaries never
// transit the app server. The DB stores only secure_url + public_id.

export function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Signs a Cloudinary upload request: SHA-1 over the alphabetically-sorted
 * param string + API secret, per Cloudinary's signed-upload protocol.
 */
export function signUploadParams(params: Record<string, string | number>): {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder?: string;
} {
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || undefined;

  const toSign: Record<string, string | number> = { ...params, timestamp };
  if (folder) toSign.folder = folder;

  const sorted = Object.keys(toSign)
    .sort()
    .map((k) => `${k}=${toSign[k]}`)
    .join("&");

  const signature = crypto
    .createHash("sha1")
    .update(sorted + apiSecret)
    .digest("hex");

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder,
  };
}

/**
 * Deletes an uploaded asset so removed images don't accrue storage cost
 * (FSD §4.6). Best-effort: failures are logged, never surfaced to the admin.
 */
export async function destroyCloudinaryAsset(publicId: string): Promise<void> {
  if (!cloudinaryConfigured() || !publicId) return;

  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: process.env.CLOUDINARY_API_KEY!,
    signature,
  });

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
      { method: "POST", body }
    );
    if (!res.ok) {
      console.error(`Cloudinary destroy failed for ${publicId}: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`Cloudinary destroy failed for ${publicId}:`, err);
  }
}

/** Fire-and-forget cleanup of many assets (e.g. on trip delete). */
export function destroyCloudinaryAssets(publicIds: (string | null | undefined)[]): void {
  for (const id of publicIds) {
    if (id) void destroyCloudinaryAsset(id);
  }
}
