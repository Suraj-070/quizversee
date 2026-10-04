import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * POST /api/admin/upload
 *
 * Accepts a multipart/form-data upload with a single `file` field.
 * Converts the image to a base64 data URI and returns it.
 *
 * The data URI is stored directly in the Question table's image fields
 * (questionImage, optionAImage, etc.). This keeps the sandbox simple —
 * no filesystem or object storage to manage. For production, swap this
 * for an S3/Supabase Storage upload that returns a URL.
 *
 * Accepted: image/png, image/jpeg, image/webp, image/gif, image/svg+xml
 * Max size: 2 MB (enforced here; the client also validates).
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file field provided" },
      { status: 400 }
    );
  }

  // Validate type
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: `File type ${file.type} is not allowed. Use PNG, JPEG, WebP, GIF, or SVG.` },
      { status: 400 }
    );
  }

  // Validate size (2 MB max)
  const MAX_BYTES = 2 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 2 MB." },
      { status: 400 }
    );
  }

  // Convert to base64 data URI
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  return NextResponse.json({
    dataUri,
    size: file.size,
    type: file.type,
  });
}
