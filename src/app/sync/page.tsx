"use client";

import { useState, useEffect } from "react";
import { getGymCode, setGymCode, clearGymCode } from "../lib/gymCode";
import { pullFromCloud, pushAllToCloud } from "../lib/sync";
import { supabase } from "../lib/supabase";

export default function SyncPage() {
  const [code, setCode]         = useState("");
  const [saved, setSaved]       = useState("");
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading]   = useState(false);
  const isConfigured = !!supabase;

  useEffect(() => {
    const c = getGymCode();
    setSaved(c);
    setCode(c);
  }, []);

  function handleSaveCode() {
    if (!code.trim()) { setMsg({ text: "코드를 입력해 주세요.", ok: false }); return; }
    setGymCode(code.trim());
    setSaved(code.trim());
    setMsg({ text: `헬스장 코드 "${code.trim()}" 저장 완료!`, ok: true });
  }

  function handleClear() {
    clearGymCode();
    setCode("");
    setSaved("");
    setMsg({ text: "코드가 삭제되었습니다.", ok: false });
  }

  async function handlePull() {
    setLoading(true); setMsg(null);
    const result = await pullFromCloud();
    setMsg({ text: result.message, ok: result.ok });
    setLoading(false);
  }

  async function handlePush() {
    setLoading(true); setMsg(null);
    const result = await pushAllToCloud();
    setMsg({ text: result.message, ok: result.ok });
    setLoading(false);
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold text-zinc-800">📱 모바일 동기화 설정</h1>

      {/* Supabase 미설정 경고 */}
      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
          <p className="font-semibold">⚠️ Supabase 환경 변수가 설정되지 않았습니다</p>
          <p>아래 가이드를 따라 설정한 뒤 앱을 다시 배포하면 동기화가 활성화됩니다.</p>
        </div>
      )}

      {/* 헬스장 코드 */}
      <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-zinc-700">🏷️ 헬스장 코드</h2>
        <p className="text-xs text-zinc-500">
          PC와 모바일에서 같은 코드를 입력하면 데이터가 공유됩니다.
          영문·숫자 조합으로 나만의 코드를 만드세요 (예: mygym2024)
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm"
            placeholder="헬스장 코드 입력 (예: mygym2024)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveCode()}
          />
          <button
            onClick={handleSaveCode}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            저장
          </button>
          {saved && (
            <button
              onClick={handleClear}
              className="border border-zinc-300 text-zinc-500 px-3 py-2 rounded-lg text-sm hover:bg-zinc-50"
            >
              삭제
            </button>
          )}
        </div>
        {saved && (
          <p className="text-xs text-emerald-600 font-medium">✅ 현재 코드: {saved}</p>
        )}
      </section>

      {/* 동기화 버튼 */}
      <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-zinc-700">🔄 데이터 동기화</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handlePull}
            disabled={loading || !isConfigured || !saved}
            className="bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "⏳ 처리 중..." : "☁️ 클라우드에서 받기"}
          </button>
          <button
            onClick={handlePush}
            disabled={loading || !isConfigured || !saved}
            className="bg-blue-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "⏳ 처리 중..." : "⬆️ 클라우드로 올리기"}
          </button>
        </div>
        <p className="text-xs text-zinc-400">
          • 모바일에서 처음 시작할 때: <strong>클라우드에서 받기</strong><br />
          • PC 데이터를 백업하거나 모바일로 보낼 때: <strong>클라우드로 올리기</strong><br />
          • 데이터 저장 시 자동으로 클라우드에 업로드됩니다
        </p>
        {msg && (
          <div className={`rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {msg.ok ? "✅" : "❌"} {msg.text}
          </div>
        )}
      </section>

      {/* Supabase 설정 가이드 */}
      <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-zinc-700">⚙️ Supabase 설정 가이드</h2>
        <div className="text-sm text-zinc-600 space-y-4">
          <div>
            <p className="font-semibold text-zinc-800 mb-1">1단계 — Supabase 가입 및 프로젝트 생성</p>
            <ol className="list-decimal pl-4 space-y-1 text-zinc-600">
              <li><a href="https://supabase.com" target="_blank" className="text-blue-600 underline">supabase.com</a> 접속 → 무료 가입 (GitHub 계정으로 로그인 가능)</li>
              <li>대시보드에서 <strong>New Project</strong> 클릭</li>
              <li>프로젝트 이름 입력 (예: my-gym) → 비밀번호 설정 → <strong>Create new project</strong></li>
            </ol>
          </div>

          <div>
            <p className="font-semibold text-zinc-800 mb-1">2단계 — 데이터베이스 테이블 생성</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>좌측 메뉴 → <strong>SQL Editor</strong></li>
              <li>아래 SQL 전체를 복사해 붙여넣기 후 <strong>Run</strong></li>
            </ol>
            <pre className="bg-zinc-900 text-green-400 text-xs rounded-lg p-3 mt-2 overflow-x-auto whitespace-pre">
{`create table gym_data (
  gym_code   text not null,
  collection text not null,
  data       jsonb default '[]',
  updated_at timestamptz default now(),
  primary key (gym_code, collection)
);
alter table gym_data enable row level security;
create policy "public_access" on gym_data
  for all using (true) with check (true);`}
            </pre>
          </div>

          <div>
            <p className="font-semibold text-zinc-800 mb-1">3단계 — API 키 복사</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>좌측 메뉴 → <strong>Project Settings</strong> → <strong>API</strong></li>
              <li><strong>Project URL</strong> 복사 → 메모장에 저장</li>
              <li><strong>anon public</strong> 키 복사 → 메모장에 저장</li>
            </ol>
          </div>

          <div>
            <p className="font-semibold text-zinc-800 mb-1">4단계 — 환경 변수 설정</p>
            <p>프로젝트 루트에 <code className="bg-zinc-100 px-1 rounded">.env.local</code> 파일을 만들고 아래 내용을 붙여넣으세요:</p>
            <pre className="bg-zinc-900 text-green-400 text-xs rounded-lg p-3 mt-2 overflow-x-auto whitespace-pre">
{`NEXT_PUBLIC_SUPABASE_URL=여기에_Project_URL_붙여넣기
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_anon_키_붙여넣기`}
            </pre>
          </div>

          <div>
            <p className="font-semibold text-zinc-800 mb-1">5단계 — 앱 재배포</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>터미널에서 <code className="bg-zinc-100 px-1 rounded">npm run build</code> 실행</li>
              <li>GitHub에 push → Vercel 또는 호스팅 서비스에서 자동 배포</li>
              <li>설정 완료 후 이 페이지에서 <strong>헬스장 코드</strong>를 입력하고 저장</li>
              <li>모바일에서도 같은 코드 입력 → <strong>클라우드에서 받기</strong> 클릭</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
