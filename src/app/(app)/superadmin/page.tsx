"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

interface GymCustomer {
  id: string;
  email: string;
  full_name: string;
  branch: string;
  gym_code: string;
  role: string;
  created_at: string;
}

const TABS = ["고객사 목록", "구독 관리", "문의·요청", "공지사항"] as const;
type Tab = typeof TABS[number];

/* ── 날짜 포맷 ── */
function fmtDate(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/* ── 가입일 기준 경과일 ── */
function daysSince(iso?: string) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function SuperAdminPage() {
  const { isPlatformOwner, loading } = useAuth();
  const router = useRouter();

  const [tab, setTab]           = useState<Tab>("고객사 목록");
  const [customers, setCustomers] = useState<GymCustomer[]>([]);
  const [fetching, setFetching]   = useState(true);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<GymCustomer | null>(null);

  /* 권한 체크 */
  useEffect(() => {
    if (!loading && !isPlatformOwner) router.replace("/dashboard");
  }, [loading, isPlatformOwner, router]);

  /* 고객사(헬스장 superadmin) 불러오기 */
  useEffect(() => {
    if (!isPlatformOwner) return;
    loadCustomers();
  }, [isPlatformOwner]);

  const loadCustomers = async () => {
    if (!supabase) return;
    setFetching(true);
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("role", "superadmin")
      .order("created_at", { ascending: false });
    setCustomers(data ?? []);
    setFetching(false);
  };

  if (loading || !isPlatformOwner) return null;

  const filtered = customers.filter((c) =>
    !search ||
    c.email.includes(search) ||
    c.full_name?.includes(search) ||
    c.gym_code?.includes(search)
  );

  /* ── 통계 ── */
  const stats = {
    total: customers.length,
    newThisMonth: customers.filter((c) => {
      const d = new Date(c.created_at);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length,
    newToday: customers.filter((c) => daysSince(c.created_at) === 0).length,
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-8 text-white">
        <p className="text-xs font-semibold text-purple-200 mb-1">핏보스 총관리자</p>
        <h1 className="text-2xl font-black">운영 대시보드</h1>
        <p className="text-sm text-purple-200 mt-1">FitBoss 고객사 통합 관리</p>

        {/* 탭 */}
        <div className="flex gap-1 mt-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition ${
                tab === t
                  ? "bg-white text-purple-700"
                  : "text-purple-200 hover:text-white hover:bg-white/10"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* ══ 고객사 목록 탭 ══ */}
        {tab === "고객사 목록" && (
          <>
            {/* 통계 카드 */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "전체 고객사", value: stats.total, color: "text-purple-600" },
                { label: "이번달 신규", value: stats.newThisMonth, color: "text-blue-600" },
                { label: "오늘 신규",   value: stats.newToday,    color: "text-emerald-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl border border-zinc-100 p-4 text-center shadow-sm">
                  <p className={`text-2xl font-black ${color}`}>{value}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* 검색 */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이메일 · 이름 · 헬스장 코드 검색"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>

            {/* 고객사 목록 */}
            {fetching ? (
              <div className="text-center py-16 text-zinc-400 text-sm">불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center text-zinc-400 text-sm">
                {search ? "검색 결과가 없습니다." : "가입한 고객사가 없습니다."}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm hover:border-purple-200 transition cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* 이름 + 배지 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-zinc-900 truncate">
                            {c.full_name || "(이름 없음)"}
                          </p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 shrink-0">
                            구매자
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{c.email}</p>

                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {c.gym_code && (
                            <span className="text-xs text-zinc-500 bg-zinc-50 px-2 py-0.5 rounded-lg">
                              🔑 {c.gym_code}
                            </span>
                          )}
                          {c.branch && (
                            <span className="text-xs text-zinc-500">📍 {c.branch}</span>
                          )}
                          <span className="text-xs text-zinc-400">
                            가입 {fmtDate(c.created_at)} ({daysSince(c.created_at)}일 전)
                          </span>
                        </div>
                      </div>

                      <div className="text-zinc-300 shrink-0">›</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ 구독 관리 탭 ══ */}
        {tab === "구독 관리" && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center space-y-3">
            <p className="text-4xl">🔧</p>
            <p className="font-bold text-zinc-700">준비 중</p>
            <p className="text-sm text-zinc-400">구독 요금제 및 결제 관리 기능을 개발 중입니다.</p>
          </div>
        )}

        {/* ══ 문의·요청 탭 ══ */}
        {tab === "문의·요청" && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center space-y-3">
            <p className="text-4xl">📬</p>
            <p className="font-bold text-zinc-700">준비 중</p>
            <p className="text-sm text-zinc-400">고객 문의 및 기능 요청 수신함을 개발 중입니다.</p>
          </div>
        )}

        {/* ══ 공지사항 탭 ══ */}
        {tab === "공지사항" && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center space-y-3">
            <p className="text-4xl">📢</p>
            <p className="font-bold text-zinc-700">준비 중</p>
            <p className="text-sm text-zinc-400">전체 고객사 공지사항 발송 기능을 개발 중입니다.</p>
          </div>
        )}
      </div>

      {/* ══ 고객사 상세 모달 ══ */}
      {selected && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelected(null)} />
          <div className="fixed inset-x-4 bottom-4 top-4 z-50 max-w-lg mx-auto bg-white rounded-3xl shadow-2xl overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-6 text-white rounded-t-3xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-purple-200 mb-1">고객사 상세</p>
                  <h2 className="text-xl font-black">{selected.full_name || "(이름 없음)"}</h2>
                  <p className="text-sm text-purple-200 mt-0.5">{selected.email}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white text-sm"
                >✕</button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* 기본 정보 */}
              <section>
                <p className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-3">기본 정보</p>
                <div className="space-y-2.5">
                  {[
                    { label: "이메일",      value: selected.email },
                    { label: "이름",        value: selected.full_name || "-" },
                    { label: "헬스장 코드", value: selected.gym_code || "-" },
                    { label: "지점명",      value: selected.branch || "-" },
                    { label: "가입일",      value: fmtDate(selected.created_at) },
                    { label: "경과일",      value: `${daysSince(selected.created_at)}일` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-zinc-50">
                      <span className="text-xs text-zinc-400 font-medium">{label}</span>
                      <span className="text-sm font-semibold text-zinc-700">{value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 구독 상태 (추후 연동) */}
              <section>
                <p className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-3">구독 상태</p>
                <div className="bg-zinc-50 rounded-2xl p-4 text-center text-sm text-zinc-400">
                  구독 정보 연동 예정
                </div>
              </section>

              {/* 액션 버튼 */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    if (confirm(`"${selected.full_name || selected.email}" 계정을 정지하시겠습니까?`)) {
                      // TODO: 계정 정지 처리
                      alert("준비 중인 기능입니다.");
                    }
                  }}
                  className="flex-1 py-3 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition"
                >
                  계정 정지
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
