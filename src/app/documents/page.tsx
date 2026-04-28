"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getDocuments, uploadDocument, deleteDocument, getDownloadUrl,
  GymDocument, DOC_CATEGORIES, CATEGORY_ICON, formatFileSize,
} from "../lib/documents";
import { supabase } from "../lib/supabase";

export default function DocumentsPage() {
  const { isAdmin } = useAuth();
  const [docs, setDocs]               = useState<GymDocument[]>([]);
  const [filter, setFilter]           = useState("전체");
  const [uploading, setUploading]     = useState(false);
  const [showUpload, setShowUpload]   = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [form, setForm]               = useState({ name: "", description: "", category: "계약서" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [msg, setMsg]                 = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDocs(getDocuments()); }, []);

  const filtered = filter === "전체" ? docs : docs.filter((d) => d.category === filter);

  function showMsg(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  }

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    const result = await uploadDocument(selectedFile, form);
    setUploading(false);
    if (result.ok) {
      setDocs(getDocuments());
      setShowUpload(false);
      setSelectedFile(null);
      setForm({ name: "", description: "", category: "계약서" });
      showMsg("ok", "파일이 업로드되었습니다.");
    } else {
      showMsg("err", result.error ?? "업로드에 실패했습니다.");
    }
  };

  const handleDownload = async (doc: GymDocument) => {
    setDownloading(doc.id);
    const url = await getDownloadUrl(doc.filePath);
    setDownloading(null);
    if (!url) { showMsg("err", "다운로드 링크를 가져올 수 없습니다."); return; }
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    a.target = "_blank";
    a.click();
  };

  const handleDelete = async (doc: GymDocument) => {
    if (!confirm(`"${doc.name}" 파일을 삭제하시겠습니까?`)) return;
    const result = await deleteDocument(doc);
    if (result.ok) {
      setDocs(getDocuments());
      showMsg("ok", "삭제되었습니다.");
    } else {
      showMsg("err", result.error ?? "삭제 실패");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">📂 문서 자료실</h1>
            <p className="text-sm text-zinc-500 mt-0.5">계약서 · 동의서 · 운영 양식 다운로드</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition"
            >
              + 파일 추가
            </button>
          )}
        </div>

        {/* Supabase 미설정 안내 */}
        {!supabase && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
            <p className="font-bold">⚠️ Supabase 연결 필요</p>
            <p>설정 → 동기화 메뉴에서 Supabase를 연결해야 파일을 업로드·다운로드할 수 있습니다.</p>
          </div>
        )}

        {/* Supabase 버킷 설정 안내 (관리자만) */}
        {isAdmin && supabase && docs.length === 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1.5">
            <p className="font-bold text-sm">📦 처음 사용 전 버킷 생성 필요</p>
            <p>1. <strong>Supabase 대시보드</strong> → <strong>Storage</strong> 메뉴 접속</p>
            <p>2. <strong>New bucket</strong> 클릭 → 이름: <code className="bg-blue-100 px-1 rounded font-mono">gym-documents</code></p>
            <p>3. <strong>Public bucket</strong> 체크 → 저장</p>
            <p className="text-blue-500">완료 후 파일 추가 버튼을 눌러 업로드하세요.</p>
          </div>
        )}

        {/* 알림 메시지 */}
        {msg && (
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-red-50 text-red-700 border border-red-100"
          }`}>
            {msg.type === "ok" ? "✅" : "❌"} {msg.text}
          </div>
        )}

        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {["전체", ...DOC_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                filter === cat
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-zinc-200 text-zinc-500 hover:border-blue-300"
              }`}
            >
              {cat !== "전체" && `${CATEGORY_ICON[cat]} `}{cat}
            </button>
          ))}
        </div>

        {/* 문서 목록 */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center space-y-2">
            <p className="text-4xl">📂</p>
            <p className="font-bold text-zinc-600">등록된 문서가 없습니다</p>
            {isAdmin
              ? <p className="text-sm text-zinc-400">우측 상단 &apos;+ 파일 추가&apos; 버튼으로 업로드하세요</p>
              : <p className="text-sm text-zinc-400">관리자가 문서를 등록하면 여기에 표시됩니다</p>
            }
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((doc) => (
              <div key={doc.id} className="bg-white rounded-2xl border border-zinc-100 p-4 hover:border-blue-100 transition">
                <div className="flex items-start justify-between gap-3">
                  {/* 아이콘 + 정보 */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0 mt-0.5">
                      {CATEGORY_ICON[doc.category] ?? "📁"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-zinc-900 text-sm leading-snug">{doc.name}</p>
                      {doc.description && (
                        <p className="text-xs text-zinc-500 mt-0.5">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                          {doc.category}
                        </span>
                        <span className="text-[10px] text-zinc-400">{formatFileSize(doc.fileSize)}</span>
                        <span className="text-[10px] text-zinc-400">
                          {new Date(doc.uploadedAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 버튼 */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                      className="flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {downloading === doc.id ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                      ) : "⬇️"}
                      {downloading === doc.id ? "" : "다운로드"}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(doc)}
                        className="w-7 h-7 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition font-black text-base"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 업로드 모달 ─────────────────────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl shadow-2xl p-6 space-y-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between">
              <p className="font-black text-zinc-900 text-lg">파일 업로드</p>
              <button
                onClick={() => { setShowUpload(false); setSelectedFile(null); }}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 transition"
              >
                ✕
              </button>
            </div>

            {/* 파일 선택 영역 */}
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                selectedFile
                  ? "border-blue-300 bg-blue-50"
                  : "border-zinc-200 hover:border-blue-300 hover:bg-blue-50/50"
              }`}
            >
              {selectedFile ? (
                <>
                  <p className="text-3xl mb-2">📄</p>
                  <p className="text-sm font-bold text-zinc-800 truncate px-4">{selectedFile.name}</p>
                  <p className="text-xs text-zinc-400 mt-1">{formatFileSize(selectedFile.size)}</p>
                  <p className="text-xs text-blue-500 mt-1">클릭해서 다른 파일 선택</p>
                </>
              ) : (
                <>
                  <p className="text-3xl mb-2">📁</p>
                  <p className="text-sm font-semibold text-zinc-500">클릭해서 파일 선택</p>
                  <p className="text-xs text-zinc-400 mt-1">PDF · Word · Excel · 이미지 등</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setSelectedFile(f);
                    if (!form.name) setForm((prev) => ({ ...prev, name: f.name.replace(/\.[^.]+$/, "") }));
                  }
                }}
              />
            </div>

            {/* 문서명 */}
            <div>
              <label className="text-xs font-bold text-zinc-500 mb-1.5 block">문서명 *</label>
              <input
                type="text"
                placeholder="예: PT 계약서 (2025년 양식)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="text-xs font-bold text-zinc-500 mb-1.5 block">설명 (선택)</label>
              <input
                type="text"
                placeholder="예: 신규 회원 등록 시 필수 서명"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="text-xs font-bold text-zinc-500 mb-2 block">카테고리</label>
              <div className="flex flex-wrap gap-2">
                {DOC_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      form.category === cat
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    {CATEGORY_ICON[cat]} {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 업로드 버튼 */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !form.name.trim() || uploading}
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  업로드 중...
                </span>
              ) : "⬆️ 업로드"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
