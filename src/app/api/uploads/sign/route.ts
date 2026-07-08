import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { cloudinaryConfigured, signUploadParams } from "@/lib/cloudinary";

// FSD §6 — POST /api/uploads/sign: returns a signed Cloudinary upload token
// so the browser uploads directly to Cloudinary (FSD §4.6).
export async function POST() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  if (!cloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Image uploads are not configured. Set the CLOUDINARY_* environment variables." },
      { status: 503 }
    );
  }

  return NextResponse.json(signUploadParams({}));
}
