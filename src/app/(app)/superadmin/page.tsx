"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { BUSINESS_CONFIGS, BusinessType } from "../../lib/store";

interface GymCustomer {
  id: string;
  email: string;
  full_name: string;
  branch: string;
  gym_code: string;
  role: string;
  business_type?: string;
  created_at: string;
}

const TABS = ["승인 대기", "고객사 목록", "공지사항"] as const;
type Tab = typeof TABS[number];

function fmtDate(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}
function daysSince(iso?: string) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function bizLabel(bt?: string) {
  if (!bt) return { icon: "✏️", label: "미설정" };
  const cfg = BUSINESS_CONFIGS[bt as BusinessType];
  return cfg ? { icon: cfg.icon, label: cfg.label } : { icon: "✏️", label: bt };
}

export default function SuperAdminPage() {
  const { isPlatformOwner, loading } = useAuth();
  const router = useRouter();

  const [tab,       setTab]      = useState<Tab>("승인 대기");
  const [pending,   setPending]  = useState<GymCustomer[]>([]);
  const [customers, setCustomers] = useState<GymCustomer[]>([]);
  const [fetching,  setFetching] = useState(true);
  const [search,    setSearch]   = useState("");
  const [selected,  setSelected] = useState<GymCustomer | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isPlatformOwner) router.replace("/dashboard");
  }, [loading, isPlatformOwner, router]);

  const loadAll = useCallback(async () => {
    if (!supabase || !isPlatformOwner) return;
    setFetching(true);
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .in("role", ["pending", "superadmin"])
      .order("created_at", { ascending: false });

    const all = data ?? [];
    setPending(all.filter((c) => c.role === "pending"));
    setCustomers(all.filter((c) => c.role === "superadmin"));
    setFetching(false);
  }, [isPlatformOwner]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading || !isPlatformOwner) return null;

  /* ── 승인 처리 ── */
  const handleApprove = async (customer: GymCustomer) => {
    if (!supabase) return;
    setActionLoading(customer.id);
    await supabase
      .from("user_profiles")
      .update({ role: "superadmin" })
      .eq("id", customer.id);
    await loadAll();
    setSelected(null);
    setActionLoading(null);
  };

  /* ── 거절/삭제 처리 ── */
  const handleReject = async (customer: GymCustomer) => {
    if (!supabase) return;
    if (!confirm(`"${customer.full_name || customer.email}" 계정을 거절하시겠습니까?\n삭제 후 복구가 불가합니다.`)) return;
    setActionLoading(customer.id);
    await supabase.from("user_profiles").delete().eq("id", customer.id);
    await loadAll();
    setSelected(null);
    setActionLoading(null);
  };

  /* ── 계정 정지 ── */
  const handleSuspend = async (customer: GymCustomer) => {
    if (!supabase) return;
    if (!confirm(`"${customer.full_name || customer.email}" 계정을 정지하시겠습니까?`)) return;
    setActionLoading(customer.id);
    await supabase
      .from("user_profiles")
      .update({ role: "pending" })
      .eq("id", customer.id);
    await loadAll();
    setSelected(null);
    setActionLoading(null);
  };

  const filtered = (tab === "승인 대기" ? pending : customers).filter((c) =>
    !search ||
    c.email?.includes(search) ||
    c.full_name?.includes(search) ||
    c.gym_code?.includes(search) ||
    c.business_type?.includes(search)
  );

  const stats = {
    pending:  pending.length,
    active:   customers.length,
    newMonth: customers.filter((c) => {
      const d = new Date(c.created_at); const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length,
  };

  return (
    <div className="min-h-screen bg-zinc-50">

      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-8 text-white">
        <p className="text-xs font-bold text-purple-200 mb-1">핏보스 총관리자</p>
        <h1 className="text-2xl font-black">운영 대시보드</h1>
        <p className="text-sm text-purple-200 mt-0.5">FitBoss 고객사 통합 관리</p>

        {/* 탭 */}
        <div className="flex gap-1 mt-5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(""); }}
              className={`relative px-4 py-2 rounded-full text-xs font-bold transition ${
                tab === t ? "bg-white text-purple-700" : "text-purple-200 hover:text-white hover:bg-white/10"
              }`}
            >
              {t}
              {t === "승인 대기" && stats.pending > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                  {stats.pending}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── 통계 카드 ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "승인 대기",   value: stats.pending,  color: "text-amber-500"   },
            { label: "활성 고객사", value: stats.active,   color: "text-purple-600"  },
            { label: "이번달 신규", value: stats.newMonth, color: "text-emerald-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-zinc-100 p-4 text-center shadow-sm">
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── 공지사항 탭 ── */}
        {tab === "공지사항" && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center space-y-3">
            <p className="text-4xl">📢</p>
            <p className="font-bold text-zinc-700">준비 중</p>
            <p className="text-sm text-zinc-400">전체 고객사 공지사항 발송 기능을 개발 중입니다.</p>
          </div>
        )}

        {/* ── 승인 대기 / 고객사 목록 탭 공통 ── */}
        {(tab === "승인 대기" || tab === "고객사 목록") && (
          <>
            {/* 검색 */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 · 이메일 · 사업자유형 검색"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>

            {/* 목록 */}
            {fetching ? (
              <div className="text-center py-16 text-zinc-400 text-sm">불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
                <p className="text-3xl mb-3">{tab === "승인 대기" ? "🎉" : "🏢"}</p>
                <p className="text-zinc-500 text-sm font-medium">
                  {tab === "승인 대기"
                    ? search ? "검색 결과가 없습니다." : "승인 대기 중인 계정이 없습니다."
                    : search ? "검색 결과가 없습니다." : "등록된 고객사가 없습니다."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((c) => {
                  const biz = bizLabel(c.business_type);
                  const isLoading = actionLoading === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className={`bg-white rounded-2xl border p-4 shadow-sm cursor-pointer transition ${
                        tab === "승인 대기"
                          ? "border-amber-100 hover:border-amber-300"
                          : "border-zinc-100 hover:border-purple-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* 이름 + 역할 배지 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-zinc-900 truncate">
                              {c.full_name || "(이름 없음)"}
                            </p>
                            {tab === "승인 대기" ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 shrink-0">
                                ⏳ 승인 대기
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                                ✓ 활성
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">{c.email}</p>

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {/* 사업자 유형 */}
                            <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-lg font-medium">
                              {biz.icon} {biz.label}
                            </span>
                            {c.gym_code && (
                              <span className="text-xs text-zinc-400">🔑 {c.gym_code}</span>
                            )}
                            <span className="text-xs text-zinc-400">
                              {fmtDate(c.created_at)} 가입
                            </span>
                          </div>
                        </div>

                        {/* 빠른 승인 버튼 (승인 대기 탭) */}
                        {tab === "승인 대기" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApprove(c); }}
                            disabled={isLoading}
                            className="shrink-0 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-50 transition"
                          >
                            {isLoading ? "처리 중..." : "✓ 승인"}
                          </button>
                        )}
                        {tab !== "승인 대기" && (
                          <div className="text-zinc-300 shrink-0">›</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 상세 모달 ── */}
      {selected && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelected(null)} />
          <div className="fixed inset-x-4 bottom-0 top-16 z-50 max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl overflow-y-auto">
            {/* 모달 헤더 */}
            <div className={`px-6 py-5 text-white rounded-t-3xl ${
              selected.role === "pending"
                ? "bg-gradient-to-r from-amber-500 to-orange-400"
                : "bg-gradient-to-r from-purple-700 to-purple-500"
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs opacity-80 mb-1">
                    {selected.role === "pending" ? "⏳ 승인 대기 계정" : "✓ 활성 고객사"}
                  </p>
                  <h2 className="text-xl font-black">{selected.full_name || "(이름 없음)"}</h2>
                  <p className="text-sm opacity-80 mt-0.5">{selected.email}</p>
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
                <div className="space-y-0">
                  {[
                    { label: "이름",        value: selected.full_name || "-" },
                    { label: "이메일",      value: selected.email },
                    { label: "사업자 유형", value: `${bizLabel(selected.business_type).icon} ${bizLabel(selected.business_type).label}` },
                    { label: "헬스장 코드", value: selected.gym_code || "-" },
                    { label: "지점명",      value: selected.branch || "-" },
                    { label: "가입일",      value: fmtDate(selected.created_at) },
                    { label: "경과",        value: `${daysSince(selected.created_at)}일 전` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2.5 border-b border-zinc-50 last:border-0">
                      <span className="text-xs text-zinc-400 font-medium">{label}</span>
                      <span className="text-sm font-semibold text-zinc-800">{value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 액션 버튼 */}
              <section className="space-y-2.5 pt-1">
                {selected.role === "pending" ? (
                  <>
                    <button
                      onClick={() => handleApprove(selected)}
                      disabled={actionLoading === selected.id}
                      className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-50 transition"
                    >
                      {actionLoading === selected.id ? "처리 중..." : "✓ 계정 승인하기"}
                    </button>
                    <button
                      onClick={() => handleReject(selected)}
                      disabled={actionLoading === selected.id}
                      className="w-full py-3.5 rounded-2xl border border-red-200 text-red-500 font-semibold hover:bg-red-50 disabled:opacity-50 transition text-sm"
                    >
                      거절 및 삭제
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleSuspend(selected)}
                    disabled={actionLoading === selected.id}
                    className="w-full py-3.5 rounded-2xl border border-red-200 text-red-500 font-semibold hover:bg-red-50 disabled:opacity-50 transition text-sm"
                  >
                    {actionLoading === selected.id ? "처리 중..." : "계정 정지"}
                  </button>
                )}
                <button
                  onClick={() => setSelected(null)}
                  className="w-full py-3.5 rounded-2xl bg-zinc-100 text-zinc-600 font-semibold hover:bg-zinc-200 transition text-sm"
                >
                  닫기
                </button>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
