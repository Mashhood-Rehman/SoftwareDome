import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { requireUser } from "@/lib/require-user";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large (max 5MB): ${file.name}` }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "user_profiles" }, (error, result) => {
          if (error || !result) reject(error ?? new Error("Cloudinary upload returned no result"));
          else resolve(result as { secure_url: string });
        })
        .end(buffer);
    });

    return NextResponse.json({ url: result.secure_url }, { status: 200 });
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
