"use client";

import { useState, useEffect } from "react";
import { getGymCode, setGymCode, clearGymCode } from "../lib/gymCode";
import { pullFromCloud, pushAllToCloud } from "../lib/sync";
import { supabase } from "../lib/supabase";

const COLLECTIONS = [
  { key: "members",     label: "👤 회원",       lsKey: "gym_members"      },
  { key: "trainers",    label: "🏋️ 트레이너",   lsKey: "gym_trainers"     },
  { key: "costs",       label: "💸 비용",        lsKey: "gym_costs"        },
  { key: "schedules",   label: "📅 스케줄",      lsKey: "gym_schedule"     },
  { key: "settlements", label: "💰 급여정산",    lsKey: "gym_settlements"  },
  { key: "receivables", label: "📋 미수금",      lsKey: "gym_receivables"  },
  { key: "taxInvoices", label: "🧾 세금계산서",  lsKey: "gym_tax_invoices" },
  { key: "branches",    label: "🏢 지점",        lsKey: "gym_branches"     },
];

export default function SyncPage() {
  const [code,      setCode]      = useState("");
  const [saved,     setSaved]     = useState("");
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [syncTime,  setSyncTime]  = useState("");
  const [syncState, setSyncState] = useState<"idle"|"saving"|"saved"|"error">("idle");

  const isConfigured = !!supabase;

  useEffect(() => {
    const c = getGymCode();
    setSaved(c);
    setCode(c);

    // 자동저장 이벤트 수신
    function handler(e: Event) {
      const { state, time } = (e as CustomEvent).detail;
      setSyncState(state);
      if (time) setSyncTime(time);
    }
    window.addEventListener("gym-sync", handler);
    return () => window.removeEventListener("gym-sync", handler);
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
    if (result.ok) {
      const t = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      setSyncTime(t);
      setSyncState("saved");
    }
    setLoading(false);
  }

  // 컬렉션별 로컬 데이터 건수
  function localCount(lsKey: string): number {
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch { return 0; }
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-5">
      <div>
        <h1 className="text-xl font-black text-zinc-800">📱 클라우드 동기화</h1>
        <p className="text-sm text-zinc-500 mt-1">데이터를 Supabase에 자동 백업 · 기기간 공유</p>
      </div>

      {/* 자동저장 상태 카드 */}
      {isConfigured && saved && (
        <div className={`rounded-2xl p-4 border text-sm font-medium flex items-center gap-3 ${
          syncState === "saved"  ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
          syncState === "saving" ? "bg-amber-50 border-amber-200 text-amber-700" :
          syncState === "error"  ? "bg-red-50 border-red-200 text-red-700" :
          "bg-zinc-50 border-zinc-200 text-zinc-500"
        }`}>
          <span className="text-2xl">
            {syncState === "saved" ? "☁️" : syncState === "saving" ? "⏳" : syncState === "error" ? "⚠️" : "💤"}
          </span>
          <div>
            <p className="font-bold">
              {syncState === "saved"  ? `자동저장 완료 (${syncTime})` :
               syncState === "saving" ? "저장 중..." :
               syncState === "error"  ? "저장 실패 — 수동 업로드를 시도해보세요" :
               "데이터 변경 시 자동저장됩니다"}
            </p>
            <p className="text-xs opacity-70 mt-0.5">
              {syncState === "saved"
                ? "회원·트레이너·비용·스케줄·정산·미수금·세금계산서·지점 8개 항목 자동 동기화"
                : "헬스장 코드 설정 완료 · 저장할 때마다 1.5초 후 자동 업로드"}
            </p>
          </div>
        </div>
      )}

      {/* Supabase 미설정 경고 */}
      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 space-y-1">
          <p className="font-bold">⚠️ Supabase 환경 변수가 설정되지 않았습니다</p>
          <p className="text-xs">아래 설정 가이드를 따라 설정한 뒤 앱을 재배포하면 자동저장이 활성화됩니다.</p>
        </div>
      )}

      {/* 헬스장 코드 */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
        <h2 className="font-bold text-zinc-700">🏷️ 헬스장 코드</h2>
        <p className="text-xs text-zinc-500">
          PC와 모바일에서 같은 코드를 사용하면 데이터가 공유됩니다.
          영문·숫자 조합으로 나만의 코드를 만드세요 (예: mygym2024)
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-zinc-300 rounded-xl px-3 py-2 text-sm"
            placeholder="헬스장 코드 입력 (예: mygym2024)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveCode()}
          />
          <button
            onClick={handleSaveCode}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition"
          >
            저장
          </button>
          {saved && (
            <button
              onClick={handleClear}
              className="border border-zinc-300 text-zinc-500 px-3 py-2 rounded-xl text-sm hover:bg-zinc-50 transition"
            >
              삭제
            </button>
          )}
        </div>
        {saved && (
          <p className="text-xs text-emerald-600 font-semibold">✅ 현재 코드: {saved}</p>
        )}
      </section>

      {/* 로컬 데이터 현황 */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
        <h2 className="font-bold text-zinc-700">📊 로컬 데이터 현황</h2>
        <div className="grid grid-cols-2 gap-2">
          {COLLECTIONS.map((c) => {
            const cnt = localCount(c.lsKey);
            return (
              <div key={c.key} className={`rounded-xl px-3 py-2 flex items-center justify-between text-xs ${
                cnt > 0 ? "bg-blue-50 text-blue-700" : "bg-zinc-50 text-zinc-400"
              }`}>
                <span>{c.label}</span>
                <span className="font-black">{cnt}건</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-zinc-400">자동저장 대상: 위 8개 컬렉션 전체</p>
      </section>

      {/* 수동 동기화 버튼 */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
        <h2 className="font-bold text-zinc-700">🔄 수동 동기화</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handlePull}
            disabled={loading || !isConfigured || !saved}
            className="bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? "⏳ 처리 중..." : "☁️ 클라우드에서 받기"}
          </button>
          <button
            onClick={handlePush}
            disabled={loading || !isConfigured || !saved}
            className="bg-blue-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? "⏳ 처리 중..." : "⬆️ 전체 백업"}
          </button>
        </div>
        <div className="text-xs text-zinc-400 space-y-0.5 bg-zinc-50 rounded-xl p-3">
          <p>• <strong>클라우드에서 받기</strong> — 다른 기기(모바일 등)에서 처음 시작할 때</p>
          <p>• <strong>전체 백업</strong> — 수동으로 즉시 업로드 (평소엔 자동저장으로 충분)</p>
          <p>• 데이터 변경 시 <strong>1.5초 후 자동 업로드</strong>됩니다</p>
        </div>
        {msg && (
          <div className={`rounded-xl px-3 py-2 text-sm font-medium ${
            msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}>
            {msg.ok ? "✅" : "❌"} {msg.text}
          </div>
        )}
      </section>

      {/* Supabase 설정 가이드 */}
      <details className="bg-white border border-zinc-200 rounded-2xl overflow-hidden group">
        <summary className="px-4 py-3 font-bold text-zinc-700 cursor-pointer flex justify-between items-center text-sm">
          <span>⚙️ Supabase 설정 가이드</span>
          <span className="text-zinc-400 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="px-4 pb-4 text-sm text-zinc-600 space-y-4">
          <div>
            <p className="font-bold text-zinc-800 mb-1">1단계 — Supabase 가입 및 프로젝트 생성</p>
            <ol className="list-decimal pl-4 space-y-1 text-zinc-600">
              <li><a href="https://supabase.com" target="_blank" className="text-blue-600 underline">supabase.com</a> 접속 → 무료 가입</li>
              <li>대시보드 → <strong>New Project</strong> 클릭 → 이름 입력 → 생성</li>
            </ol>
          </div>
          <div>
            <p className="font-bold text-zinc-800 mb-1">2단계 — 데이터베이스 테이블 생성</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>좌측 메뉴 → <strong>SQL Editor</strong></li>
              <li>아래 SQL 전체를 붙여넣고 <strong>Run</strong></li>
            </ol>
            <pre className="bg-zinc-900 text-green-400 text-xs rounded-xl p-3 mt-2 overflow-x-auto whitespace-pre">
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
            <p className="font-bold text-zinc-800 mb-1">3단계 — API 키 복사</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>좌측 메뉴 → <strong>Project Settings</strong> → <strong>API</strong></li>
              <li><strong>Project URL</strong> 복사</li>
              <li><strong>anon public</strong> 키 복사</li>
            </ol>
          </div>
          <div>
            <p className="font-bold text-zinc-800 mb-1">4단계 — 환경 변수 설정</p>
            <p>프로젝트 루트에 <code className="bg-zinc-100 px-1 rounded">.env.local</code> 파일을 만들고:</p>
            <pre className="bg-zinc-900 text-green-400 text-xs rounded-xl p-3 mt-2 overflow-x-auto whitespace-pre">
{`NEXT_PUBLIC_SUPABASE_URL=여기에_Project_URL_붙여넣기
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_anon_키_붙여넣기`}
            </pre>
          </div>
          <div>
            <p className="font-bold text-zinc-800 mb-1">5단계 — 배포</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li><code className="bg-zinc-100 px-1 rounded">npm run build</code> 실행 후 GitHub push</li>
              <li>이 페이지에서 <strong>헬스장 코드</strong> 입력 → 저장</li>
              <li>이후 모든 데이터 변경 시 <strong>자동으로 Supabase에 저장</strong>됩니다</li>
            </ol>
          </div>
        </div>
      </details>
    </div>
  );
}
