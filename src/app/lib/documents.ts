"use client";
import { supabase } from "./supabase";
import { getGymCode } from "./gymCode";

export const DOCS_BUCKET = "gym-documents";
const DOCS_KEY = "gym_documents";

export const DOC_CATEGORIES = [
  "계약서",
  "개인정보동의서",
  "운영 규정",
  "양식·서류",
  "기타",
] as const;

export const CATEGORY_ICON: Record<string, string> = {
  "계약서":       "📄",
  "개인정보동의서": "🔒",
  "운영 규정":    "📋",
  "양식·서류":    "📝",
  "기타":         "📁",
};

export interface GymDocument {
  id: string;
  name: string;
  description: string;
  category: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export function getDocuments(): GymDocument[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(DOCS_KEY) || "[]"); } catch { return []; }
}

function saveDocumentsLocal(docs: GymDocument[]) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

export async function uploadDocument(
  file: File,
  meta: { name: string; description: string; category: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const gymCode = getGymCode() || "shared";
  const safeFileName = file.name.replace(/[^\w.\-]/g, "_");
  const filePath = `${gymCode}/${Date.now()}_${safeFileName}`;

  const { error } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (error) {
    // 버킷이 없는 경우 안내
    if (error.message.includes("Bucket not found") || error.message.includes("bucket")) {
      return { ok: false, error: "스토리지 버킷 미생성 — Supabase 대시보드에서 'gym-documents' 버킷을 만들어 주세요." };
    }
    return { ok: false, error: error.message };
  }

  const docs = getDocuments();
  docs.unshift({
    id: crypto.randomUUID(),
    name: meta.name.trim() || file.name,
    description: meta.description.trim(),
    category: meta.category || "기타",
    filePath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    uploadedAt: new Date().toISOString(),
  });
  saveDocumentsLocal(docs);
  return { ok: true };
}

export async function deleteDocument(doc: GymDocument): Promise<{ ok: boolean; error?: string }> {
  if (supabase) {
    const { error } = await supabase.storage.from(DOCS_BUCKET).remove([doc.filePath]);
    if (error) return { ok: false, error: error.message };
  }
  saveDocumentsLocal(getDocuments().filter((d) => d.id !== doc.id));
  return { ok: true };
}

export async function getDownloadUrl(filePath: string): Promise<string | null> {
  if (!supabase) return null;
  // 서명 URL (1시간 유효)
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(filePath, 3600);
  if (!error && data?.signedUrl) return data.signedUrl;
  // 퍼블릭 버킷 폴백
  const { data: pub } = supabase.storage.from(DOCS_BUCKET).getPublicUrl(filePath);
  return pub?.publicUrl ?? null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
