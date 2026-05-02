"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getMembers, saveMembers, getTrainers, getBranches,
  syncMemberTotals, syncPaymentFeeToCosts,
  calcPaymentFee, calcMembershipEndDate,
  CARD_FEE_TIERS, PROGRAM_LIST,
  Member, SessionPackage, GymMembership, Trainer,
  PaymentMethod, MembershipDuration, ProgramType, MembershipCategory,
} from "../../lib/store";
import { useStaffTerm } from "../../context/StaffTermContext";
import { useAuth } from "../../context/AuthContext";

// ── 유틸 ──────────────────────────────────────────────────────────────────
function parseKorean(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[원,\s]/g, "").trim();
  if (!cleaned) return 0;
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  let total = 0;
  let remaining = cleaned;
  const match = (pattern: RegExp, unit: number) => {
    const m = remaining.match(pattern);
    if (m) { total += parseFloat(m[1]) * unit; remaining = remaining.slice(m[0].length); }
  };
  match(/^(\d+(?:\.\d+)?)억/, 100000000);
  match(/^(\d+(?:\.\d+)?)천만/, 10000000);
  match(/^(\d+(?:\.\d+)?)만/, 10000);
  match(/^(\d+(?:\.\d+)?)천/, 1000);
  if (/^\d+$/.test(remaining)) total += Number(remaining);
  return total || 0;
}
function fmtKRW(n: number)  { return "₩" + Math.round(n).toLocaleString("ko-KR"); }
function todayStr()          { return new Date().toISOString().slice(0, 10); }

function memStatus(g: GymMembership) {
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const end     = new Date(g.endDate + "T00:00:00");
  const daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (daysLeft <  0)  return { label: "만료",         color: "zinc"    };
  if (daysLeft === 0) return { label: "오늘 만료",    color: "red"     };
  if (daysLeft <= 7)  return { label: `D-${daysLeft}`, color: "orange" };
  return               { label: `${daysLeft}일 남음`, color: "emerald" };
}

// ── 상수 ──────────────────────────────────────────────────────────────────
type ProgCategory = "" | "헬스" | "골프회원권" | "기타기간제" | ProgramType;

// 전체 프로그램 목록 (사업자 유형 필터 전)
const ALL_PROG_CATS: { cat: ProgCategory; icon: string; label: string; isTimeBased?: boolean; membershipCat?: MembershipCategory; programType?: ProgramType }[] = [
  { cat: "헬스",      icon: "🏋️", label: "개인헬스",   isTimeBased: true, membershipCat: "헬스"       },
  { cat: "골프회원권", icon: "⛳", label: "골프회원권",  isTimeBased: true, membershipCat: "골프"       },
  { cat: "기타기간제", icon: "📅", label: "기간 회원권", isTimeBased: true, membershipCat: "기타기간제" },
  { cat: "PT",        icon: "💪", label: "PT",          programType: "PT"        },
  { cat: "골프레슨",  icon: "🏌️", label: "골프레슨",   programType: "골프레슨"  },
  { cat: "필라테스",  icon: "🧘", label: "필라테스",    programType: "필라테스"  },
  { cat: "GX",        icon: "💃", label: "GX",          programType: "GX"        },
  { cat: "요가",      icon: "🙏", label: "요가",        programType: "요가"      },
  { cat: "크로스핏",  icon: "🔥", label: "크로스핏",   programType: "크로스핏"  },
  { cat: "기타",      icon: "✏️", label: "기타",        programType: "기타"      },
];

const GROUP_OPTS = [
  { size: 1, label: "1:1" },
  { size: 2, label: "2:1" },
  { size: 3, label: "3:1" },
  { size: 6, label: "6:1" },
  { size: 8, label: "8:1" },
];

const SESSION_PRESETS = [10, 20, 30, 50];
const DURATIONS: MembershipDuration[] = ["1개월", "3개월", "6개월", "12개월", "월구독제"];

const PROG_ICON: Record<string, string> = {
  "헬스": "🏋️", "골프": "⛳", "골프회원권": "⛳", "기타기간제": "📅",
  PT: "💪", "골프레슨": "🏌️", "필라테스": "🧘", GX: "💃",
  "요가": "🙏", "크로스핏": "🔥", "기타": "✏️",
};

// 기간제 카테고리 → GymMembership category 매핑
const GYM_CATEGORY: Record<string, MembershipCategory> = {
  "헬스": "헬스",
  "골프회원권": "골프",
  "기타기간제": "기타기간제",
};

const STATUS_CLS: Record<string, { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700" },
  orange:  { bg: "bg-orange-50  border-orange-100",  text: "text-orange-700"  },
  red:     { bg: "bg-red-50     border-red-100",     text: "text-red-700"     },
  zinc:    { bg: "bg-zinc-50    border-zinc-100",    text: "text-zinc-400"    },
};

const PAY_METHODS: PaymentMethod[] = ["카드", "현금", "계좌이체", "간편결제", "지역화폐"];
const PAY_LABELS: Record<string, string> = {
  카드: "💳 카드", 현금: "💵 현금", 계좌이체: "🏦 이체", 간편결제: "📱 간편", 지역화폐: "🏷️ 지역화폐",
};
const PAY_CLS: Record<string, string> = {
  카드: "bg-blue-600 border-blue-600", 현금: "bg-emerald-500 border-emerald-500",
  계좌이체: "bg-indigo-500 border-indigo-500", 간편결제: "bg-orange-500 border-orange-500",
  지역화폐: "bg-purple-500 border-purple-500",
};

const emptyMember = (): Member => ({
  id: crypto.randomUUID(),
  name: "", phone: "", trainer: "", trainerType: "",
  totalPayment: 0, totalSessions: 0, conductedSessions: 0,
  packages: [], gymMemberships: [],
});

// ── 컴포넌트 ──────────────────────────────────────────────────────────────
export default function MembersPage() {
  const { staffTerm } = useStaffTerm();
  const { businessConfig } = useAuth();
  const router = useRouter();

  // 사업자 유형에 맞게 프로그램 목록 필터
  const PROG_CATS = ALL_PROG_CATS.filter((p) => {
    if (p.isTimeBased && p.membershipCat) {
      return (businessConfig.memberships as string[]).includes(p.membershipCat);
    }
    if (p.programType) {
      return (businessConfig.programs as string[]).includes(p.programType);
    }
    return true;
  });

  // 데이터
  const [members, setMembers]             = useState<Member[]>([]);
  const [trainers, setTrainers]           = useState<Trainer[]>([]);
  const [savedBranches, setSavedBranches] = useState<string[]>([]);

  // UI
  const [selectedBranch, setSelectedBranch] = useState("전체");
  const [showForm, setShowForm]             = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);

  // 회원 폼
  const [form, setForm] = useState<Member>(emptyMember());

  // 프로그램 추가 폼
  const [showProg, setShowProg]             = useState(false);
  const [progCat, setProgCat]               = useState<ProgCategory>("");
  // 개인헬스용
  const [progMemType, setProgMemType]       = useState<MembershipDuration>("1개월");
  const [progStart, setProgStart]           = useState(todayStr());
  const [progAutoRenew, setProgAutoRenew]   = useState(false);
  // 횟수제용
  const [progGroupSize, setProgGroupSize]   = useState(1);
  const [progSessions, setProgSessions]     = useState(0);
  const [progSessDirect, setProgSessDirect] = useState(false);
  const [progSessInput, setProgSessInput]   = useState("");
  // 결제 공통
  const [progPayInput, setProgPayInput]     = useState("");
  const [progPayAmt, setProgPayAmt]         = useState(0);
  const [progPayMethod, setProgPayMethod]   = useState<PaymentMethod>("");
  const [progCardRate, setProgCardRate]     = useState(0.4);
  const [progCardRateInput, setProgCardRateInput] = useState("0.4");

  useEffect(() => {
    setMembers(getMembers());
    setTrainers(getTrainers().filter((t) => t.status === "재직"));
    setSavedBranches(getBranches());
  }, []);

  // 지점 맵
  const trainerBranchMap = Object.fromEntries(trainers.map((t) => [t.name, t.branch || ""]));

  const branches = (() => {
    const all = Array.from(new Set([
      ...savedBranches,
      ...trainers.map((t) => t.branch).filter(Boolean),
    ]));
    return ["전체", ...all];
  })();

  const filteredMembers = selectedBranch === "전체"
    ? members
    : members.filter((m) => trainerBranchMap[m.trainer] === selectedBranch);

  // ── 열기/닫기 ────────────────────────────────────────────────────────────
  const resetProgForm = () => {
    setShowProg(false);
    setProgCat("");
    setProgMemType("1개월"); setProgStart(todayStr()); setProgAutoRenew(false);
    setProgGroupSize(1); setProgSessions(0); setProgSessDirect(false); setProgSessInput("");
    setProgPayInput(""); setProgPayAmt(0); setProgPayMethod("");
    setProgCardRate(0.4); setProgCardRateInput("0.4");
  };

  const openAdd = () => {
    setForm(emptyMember());
    setEditingId(null);
    resetProgForm();
    setShowForm(true);
  };

  const openEdit = (m: Member) => {
    setForm({ ...m, gymMemberships: m.gymMemberships ?? [], packages: m.packages ?? [] });
    setEditingId(m.id);
    resetProgForm();
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("삭제하시겠습니까?")) persist(members.filter((m) => m.id !== id));
  };

  // ── 저장 ─────────────────────────────────────────────────────────────────
  const persist = (updated: Member[]) => {
    setMembers(updated);
    saveMembers(updated);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const synced = syncMemberTotals(form);
    let finalMembers: Member[];
    if (editingId) {
      finalMembers = members.map((m) => (m.id === editingId ? synced : m));
    } else {
      finalMembers = [...members, { ...synced, id: crypto.randomUUID() }];
    }
    persist(finalMembers);
    syncPaymentFeeToCosts(finalMembers, new Date().toISOString().slice(0, 7));
    setShowForm(false);
  };

  // ── 트레이너 선택 ─────────────────────────────────────────────────────────
  const handleTrainerSelect = (name: string) => {
    const found = trainers.find((t) => t.name === name);
    const newType = found ? found.empType : form.trainerType;
    setForm({
      ...form,
      trainer: name,
      trainerType: newType,
      packages: (form.packages ?? []).map((p) => ({ ...p, trainerName: name, trainerType: newType })),
    });
  };

  // ── 프로그램 추가 ─────────────────────────────────────────────────────────
  const progEndDate = calcMembershipEndDate(progStart, progMemType);
  const progFee     = calcPaymentFee(progPayAmt, progPayMethod, progCardRate);
  const progNet     = progPayAmt - progFee;

  const handleAddProg = () => {
    if (progPayAmt <= 0) return;

    const isTimeBased = progCat === "헬스" || progCat === "골프회원권" || progCat === "기타기간제";

    if (isTimeBased) {
      const gm: GymMembership = {
        id: crypto.randomUUID(),
        category: GYM_CATEGORY[progCat] ?? "헬스",
        membershipType: progMemType,
        startDate: progStart,
        endDate: progEndDate,
        paymentAmount: progPayAmt,
        paymentMethod: progPayMethod,
        paymentFee: progFee,
        netAmount: progNet,
        registeredAt: todayStr(),
        autoRenew: progMemType === "월구독제" ? progAutoRenew : false,
      };
      setForm((prev) => ({ ...prev, gymMemberships: [...(prev.gymMemberships ?? []), gm] }));
    } else {
      if (progSessions <= 0) return;
      const catLabel = PROG_CATS.find((c) => c.cat === progCat)?.label ?? progCat;
      const pkg: SessionPackage = {
        id: crypto.randomUUID(),
        name: `${form.name || "회원"} ${catLabel}`,
        programType: progCat as ProgramType,
        trainerName: form.trainer,
        trainerType: form.trainerType,
        classType: progGroupSize === 1 ? "1:1" : "그룹",
        groupSize: progGroupSize,
        totalSessions: progSessions,
        conductedSessions: 0,
        paymentAmount: progPayAmt,
        paymentMethod: progPayMethod,
        paymentFee: progFee,
        netAmount: progNet,
        registeredAt: todayStr(),
      };
      setForm((prev) => ({ ...prev, packages: [...(prev.packages ?? []), pkg] }));
    }
    resetProgForm();
  };

  const handleDeletePkg    = (id: string) => setForm((prev) => ({ ...prev, packages: (prev.packages ?? []).filter((p) => p.id !== id) }));
  const handleDeleteGymMem = (id: string) => setForm((prev) => ({ ...prev, gymMemberships: (prev.gymMemberships ?? []).filter((g) => g.id !== id) }));

  // ── 요약 통계 ─────────────────────────────────────────────────────────────
  const totalPT      = filteredMembers.reduce((s, m) => s + m.totalPayment, 0);
  const totalGym     = filteredMembers.reduce((s, m) =>
    s + (m.gymMemberships ?? []).reduce((ss, g) => ss + g.paymentAmount, 0), 0);
  const activeGym    = filteredMembers.reduce((s, m) =>
    s + (m.gymMemberships ?? []).filter((g) => new Date(g.endDate) >= new Date()).length, 0);
  const remainSess   = filteredMembers.reduce((s, m) =>
    s + (m.packages ?? []).reduce((ss, p) => ss + Math.max(0, p.totalSessions - p.conductedSessions), 0), 0);

  // ── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">회원 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">회원별 프로그램 · 결제 현황</p>
          </div>
          <button onClick={openAdd}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
            + 회원 추가
          </button>
        </div>

        {/* 지점 탭 */}
        {branches.length > 1 && (
          <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl overflow-x-auto">
            {branches.map((b) => (
              <button key={b} onClick={() => setSelectedBranch(b)}
                className={`flex-shrink-0 flex-1 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                  selectedBranch === b ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                }`}>
                {b}
                <span className="ml-1 text-xs font-normal opacity-60">
                  ({b === "전체" ? members.length : members.filter((m) => trainerBranchMap[m.trainer] === b).length})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "🏋️ 개인헬스",   value: `유효 ${activeGym}건`,    sub: `₩${Math.round(totalGym/10000)}만` },
            { label: "💪 PT·수업권",  value: `잔여 ${remainSess}회`,  sub: `₩${Math.round(totalPT/10000)}만` },
            { label: "👥 전체 회원",   value: `${filteredMembers.length}명`, sub: "" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white rounded-xl border border-zinc-100 p-3 text-center">
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className="font-bold text-zinc-900 text-sm">{value}</p>
              {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        {/* 회원 목록 */}
        {filteredMembers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center text-zinc-400 text-sm">
            {selectedBranch === "전체"
              ? <>등록된 회원이 없습니다.<br />+ 회원 추가를 눌러주세요.</>
              : <><strong>{selectedBranch}</strong>에 등록된 회원이 없습니다.</>}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((m) => {
              const branch   = trainerBranchMap[m.trainer];
              const allGym   = m.gymMemberships ?? [];
              const allPkgs  = m.packages ?? [];
              const hasProg  = allGym.length > 0 || allPkgs.length > 0;
              return (
                <div key={m.id} className="bg-white rounded-2xl border border-zinc-100 p-4">
                  {/* 회원 기본 정보 */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-zinc-900">{m.name}</p>
                        {branch && selectedBranch === "전체" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-semibold">📍 {branch}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <p className="text-xs text-zinc-400">{m.trainer || `${staffTerm} 미지정`}</p>
                        {m.trainerType && (
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                            m.trainerType === "정규직" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                          }`}>{m.trainerType}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(m)} className="text-xs text-zinc-400 hover:text-blue-500 transition">수정</button>
                      <button onClick={() => handleDelete(m.id)} className="text-xs text-zinc-400 hover:text-red-500 transition">삭제</button>
                    </div>
                  </div>

                  {/* 등록 프로그램 */}
                  {hasProg ? (
                    <div className="space-y-1.5">
                      {/* 기간제 회원권 (개인헬스 / 골프) */}
                      {allGym.map((g) => {
                        const st  = memStatus(g);
                        const cls = STATUS_CLS[st.color];
                        const gymIcon  = g.category === "골프" ? "⛳" : "🏋️";
                        const gymLabel = g.category === "골프" ? "골프회원권" : "개인헬스";
                        return (
                          <div key={g.id} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${cls.bg}`}>
                            <div>
                              <span className="font-bold text-zinc-800">{gymIcon} {gymLabel} {g.membershipType}</span>
                              {g.autoRenew && <span className="ml-1 text-blue-500 font-semibold">자동갱신</span>}
                              <p className="text-zinc-400 mt-0.5">{g.startDate} ~ {g.endDate} · {fmtKRW(g.paymentAmount)}</p>
                            </div>
                            <span className={`font-bold ${cls.text}`}>{st.label}</span>
                          </div>
                        );
                      })}

                      {/* 횟수제 패키지 */}
                      {allPkgs.map((pkg) => {
                        const remain = pkg.totalSessions - pkg.conductedSessions;
                        const ratio  = pkg.totalSessions > 0 ? pkg.conductedSessions / pkg.totalSessions : 0;
                        const icon   = PROG_ICON[pkg.programType] ?? "💪";
                        const sizeLabel = GROUP_OPTS.find((o) => o.size === pkg.groupSize)?.label ?? `${pkg.groupSize}:1`;
                        return (
                          <div key={pkg.id} className={`rounded-xl border px-3 py-2 text-xs ${
                            remain === 0 ? "bg-red-50 border-red-100" : remain <= 3 ? "bg-orange-50 border-orange-100" : "bg-zinc-50 border-zinc-100"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-800">{icon} {pkg.programType} {sizeLabel}</span>
                              <span className={`font-bold ${remain === 0 ? "text-red-500" : remain <= 3 ? "text-orange-500" : "text-zinc-500"}`}>
                                {remain === 0 ? "🔴 완료" : remain <= 3 ? `⚠️ 잔여 ${remain}회` : `잔여 ${remain}회`}
                              </span>
                            </div>
                            {/* 소진 프로그레스 바 */}
                            {pkg.totalSessions > 0 && (
                              <div className="mt-1.5">
                                <div className="h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                                  <div className="h-full rounded-full bg-blue-500 transition-all"
                                    style={{ width: `${ratio * 100}%` }} />
                                </div>
                                <p className="text-zinc-400 mt-0.5">{pkg.conductedSessions}/{pkg.totalSessions}회 · {fmtKRW(pkg.paymentAmount)}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {allPkgs.length > 0 && (
                        <button onClick={() => router.push("/sessions")}
                          className="w-full text-xs text-blue-500 hover:text-blue-700 py-1 font-semibold transition text-center">
                          수업 관리에서 회차 기록 →
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-300 text-center py-2">등록된 프로그램 없음</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          회원 등록 / 수정 모달
      ══════════════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl p-6 w-full max-w-lg mx-0 sm:mx-4 space-y-5 max-h-[92vh] overflow-y-auto">

            <p className="font-black text-zinc-900 text-lg">
              {editingId ? "회원 수정" : "회원 추가"}
            </p>

            {/* ── 기본 정보 ── */}
            <section className="space-y-3">
              <Field label="이름" required>
                <input type="text" placeholder="홍길동" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={iCls} />
              </Field>

              <Field label="연락처">
                <input type="tel" placeholder="010-0000-0000" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={iCls} />
              </Field>

              {/* 수정 모드이고 트레이너가 이미 지정된 경우에만 표시 */}
              {editingId && form.trainer && (
                <Field label={`담당 ${staffTerm}`}>
                  {trainers.length > 0 ? (
                    <select value={form.trainer} onChange={(e) => handleTrainerSelect(e.target.value)} className={iCls}>
                      <option value="">{staffTerm} 선택</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.empType}{t.branch ? ` · ${t.branch}` : ""})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder={`${staffTerm} 이름`} value={form.trainer}
                      onChange={(e) => setForm({ ...form, trainer: e.target.value })}
                      className={iCls} />
                  )}
                </Field>
              )}
            </section>

            {/* ── 등록 프로그램 ── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">📋 등록 프로그램</p>
                {!showProg && (
                  <button type="button" onClick={() => setShowProg(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100">
                    + 프로그램 추가
                  </button>
                )}
              </div>

              {/* 등록된 프로그램 목록 */}
              {(form.gymMemberships ?? []).length === 0 && (form.packages ?? []).length === 0 && !showProg && (
                <div className="text-center py-6 border border-dashed border-zinc-200 rounded-2xl">
                  <p className="text-sm text-zinc-400">아직 등록된 프로그램이 없습니다</p>
                  <button type="button" onClick={() => setShowProg(true)}
                    className="mt-2 text-sm font-bold text-blue-600 hover:text-blue-800">
                    + 프로그램 추가하기
                  </button>
                </div>
              )}

              {/* 개인헬스 목록 */}
              {(form.gymMemberships ?? []).map((g) => {
                const st = memStatus(g);
                const cls = STATUS_CLS[st.color];
                return (
                  <div key={g.id} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs ${cls.bg}`}>
                    <div>
                      <p className="font-bold text-zinc-800">🏋️ 개인헬스 {g.membershipType}{g.autoRenew ? " (자동갱신)" : ""}</p>
                      <p className="text-zinc-500 mt-0.5">{g.startDate} ~ {g.endDate} · {fmtKRW(g.paymentAmount)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${cls.text}`}>{st.label}</span>
                      <button type="button" onClick={() => handleDeleteGymMem(g.id)}
                        className="text-zinc-300 hover:text-red-400 transition text-base leading-none">✕</button>
                    </div>
                  </div>
                );
              })}

              {/* 횟수제 패키지 목록 */}
              {(form.packages ?? []).map((pkg) => {
                const remain = pkg.totalSessions - pkg.conductedSessions;
                const icon   = PROG_ICON[pkg.programType] ?? "💪";
                const sl     = GROUP_OPTS.find((o) => o.size === pkg.groupSize)?.label ?? `${pkg.groupSize}:1`;
                return (
                  <div key={pkg.id} className={`rounded-xl border px-3 py-2.5 text-xs ${
                    remain === 0 ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-100"
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-zinc-800">{icon} {pkg.programType} {sl} · {pkg.totalSessions}회</p>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">{fmtKRW(pkg.paymentAmount)}</span>
                        <button type="button" onClick={() => handleDeletePkg(pkg.id)}
                          className="text-zinc-300 hover:text-red-400 transition text-base leading-none">✕</button>
                      </div>
                    </div>
                    {pkg.registeredAt && (
                      <p className="text-zinc-400 mt-0.5">등록일 {pkg.registeredAt}</p>
                    )}
                  </div>
                );
              })}

              {/* ── 프로그램 추가 인라인 폼 ── */}
              {showProg && (
                <div className="border border-blue-200 bg-blue-50/40 rounded-2xl p-4 space-y-4">

                  {/* STEP 1: 프로그램 선택 */}
                  <div>
                    <p className="text-xs font-bold text-zinc-500 mb-2">① 프로그램 선택</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {PROG_CATS.map(({ cat, icon, label }) => (
                        <button key={cat} type="button" onClick={() => { setProgCat(cat); setProgGroupSize(1); setProgSessions(0); setProgSessDirect(false); setProgSessInput(""); }}
                          className={`flex flex-col items-center py-2.5 rounded-xl text-xs font-bold border transition gap-1 ${
                            progCat === cat
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-zinc-600 border-zinc-200 hover:border-blue-300"
                          }`}>
                          <span className="text-lg leading-none">{icon}</span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* STEP 2A: 기간제 (개인헬스 / 골프회원권) — 기간 선택 */}
                  {(progCat === "헬스" || progCat === "골프회원권" || progCat === "기타기간제") && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold text-zinc-500 mb-2">② 이용 기간</p>
                        <div className="grid grid-cols-5 gap-1.5">
                          {DURATIONS.map((d) => (
                            <button key={d} type="button" onClick={() => setProgMemType(d)}
                              className={`py-2 rounded-xl text-xs font-bold border transition ${
                                progMemType === d ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-600 border-zinc-200 hover:border-blue-300"
                              }`}>
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-500 mb-1.5">시작일</p>
                        <input type="date" value={progStart} onChange={(e) => setProgStart(e.target.value)} className={iCls} />
                        <div className="flex justify-between mt-1.5 px-1 text-xs text-zinc-400">
                          <span>종료일</span>
                          <span className="font-semibold text-zinc-600">{progEndDate}
                            {progMemType !== "월구독제" && ` (${Math.round((new Date(progEndDate).getTime() - new Date(progStart).getTime()) / 86400000) + 1}일)`}
                          </span>
                        </div>
                      </div>
                      {progMemType === "월구독제" && (
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={progAutoRenew} onChange={(e) => setProgAutoRenew(e.target.checked)}
                            className="w-4 h-4 rounded accent-blue-600" />
                          <span className="font-semibold text-zinc-700">자동 갱신</span>
                          <span className="text-xs text-zinc-400">(매월 자동 결제)</span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* STEP 2B: 횟수제 — 인원 구성 + 회차 */}
                  {progCat !== "" && progCat !== "헬스" && progCat !== "골프회원권" && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold text-zinc-500 mb-2">② 인원 구성</p>
                        <div className="flex gap-2 flex-wrap">
                          {GROUP_OPTS.map(({ size, label }) => (
                            <button key={size} type="button" onClick={() => setProgGroupSize(size)}
                              className={`flex-1 min-w-[15%] py-2.5 rounded-xl text-sm font-bold border transition ${
                                progGroupSize === size ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-600 border-zinc-200 hover:border-blue-300"
                              }`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-500 mb-2">③ 판매 회차</p>
                        <div className="flex gap-2 flex-wrap">
                          {SESSION_PRESETS.map((n) => (
                            <button key={n} type="button"
                              onClick={() => { setProgSessions(n); setProgSessDirect(false); setProgSessInput(""); }}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition ${
                                !progSessDirect && progSessions === n ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-600 border-zinc-200 hover:border-blue-300"
                              }`}>
                              {n}회
                            </button>
                          ))}
                          <button type="button"
                            onClick={() => { setProgSessDirect(true); setProgSessInput(""); setProgSessions(0); }}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition ${
                              progSessDirect ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-600 border-zinc-200 hover:border-blue-300"
                            }`}>
                            직접
                          </button>
                        </div>
                        {progSessDirect && (
                          <div className="flex items-center gap-2 mt-2">
                            <input type="number" min={1} placeholder="회차 입력" value={progSessInput}
                              onChange={(e) => { setProgSessInput(e.target.value); const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setProgSessions(v); }}
                              className={iCls + " text-center"} autoFocus />
                            <span className="text-sm font-semibold text-zinc-600 whitespace-nowrap">회</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 횟수제 수업 선택 시: 담당 트레이너/강사 */}
                  {!!(progCat && progCat !== "헬스" && progCat !== "골프회원권" && progCat !== "기타기간제") && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-zinc-500">
                        ③ 담당 {progCat === "골프레슨" ? "골프 강사" : staffTerm}
                      </p>
                      {trainers.length > 0 ? (
                        <select value={form.trainer} onChange={(e) => handleTrainerSelect(e.target.value)} className={iCls}>
                          <option value="">{staffTerm} 선택 (선택 안 해도 됨)</option>
                          {trainers.map((t) => (
                            <option key={t.id} value={t.name}>
                              {t.name} ({t.empType}{t.branch ? ` · ${t.branch}` : ""})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" placeholder={`${staffTerm} 이름`} value={form.trainer}
                          onChange={(e) => setForm({ ...form, trainer: e.target.value })}
                          className={iCls} />
                      )}
                    </div>
                  )}

                  {/* STEP 3(헬스) / 4(횟수제): 결제 정보 */}
                  {progCat !== "" && (
                    <div className="space-y-3 pt-1 border-t border-blue-100">
                      <p className="text-xs font-bold text-zinc-500">
                        {(progCat === "헬스" || progCat === "골프회원권" || progCat === "기타기간제")
                          ? "③"
                          : "④"} 결제 정보
                      </p>

                      {/* 결제 수단 */}
                      <div className="flex flex-wrap gap-1.5">
                        {PAY_METHODS.map((pm) => (
                          <button key={pm} type="button"
                            onClick={() => setProgPayMethod(progPayMethod === pm ? "" : pm)}
                            className={`flex-1 min-w-[28%] py-2 rounded-xl text-xs font-semibold border transition ${
                              progPayMethod === pm ? `${PAY_CLS[pm]} text-white` : "bg-white text-zinc-500 border-zinc-200"
                            }`}>
                            {PAY_LABELS[pm]}
                          </button>
                        ))}
                      </div>

                      {/* 카드 수수료율 */}
                      {progPayMethod === "카드" && (
                        <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-semibold text-blue-700">카드 수수료율</p>
                          <div className="flex flex-wrap gap-1">
                            {CARD_FEE_TIERS.filter((t) => t.rate > 0).map((tier) => (
                              <button key={tier.rate} type="button"
                                onClick={() => { setProgCardRate(tier.rate); setProgCardRateInput(String(tier.rate)); }}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold border transition ${
                                  progCardRate === tier.rate ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-700 border-blue-200"
                                }`}>
                                {tier.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-blue-600 whitespace-nowrap">직접 입력</span>
                            <input type="number" step="0.01" min="0" max="10" value={progCardRateInput}
                              onChange={(e) => { setProgCardRateInput(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v)) setProgCardRate(v); }}
                              className="w-16 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs focus:outline-none text-right" />
                            <span className="text-xs text-blue-600">%</span>
                          </div>
                        </div>
                      )}

                      {/* 결제 금액 */}
                      <div>
                        <div className="relative">
                          <input
                            type="number" min="0" step="0.1" placeholder="0"
                            value={progPayAmt > 0 ? progPayAmt / 10000 : ""}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              const won = Math.round(v * 10000);
                              setProgPayAmt(won);
                              setProgPayInput(String(won));
                            }}
                            className={iCls + " pr-14"}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400 pointer-events-none">만원</span>
                        </div>
                        {progPayAmt > 0 && (
                          <div className="mt-2 space-y-0.5 px-1">
                            <p className="text-xs text-blue-500">결제액: {progPayAmt.toLocaleString()}원</p>
                            {progFee > 0 && <p className="text-xs text-red-400">수수료 ({progCardRate}%): −{progFee.toLocaleString()}원</p>}
                            <p className="text-xs font-bold text-emerald-600">실수령액: {progNet.toLocaleString()}원</p>
                            {(progCat === "헬스" || progCat === "골프회원권" || progCat === "기타기간제") && progPayAmt > 0 && (() => {
                              const days = Math.round((new Date(progEndDate).getTime() - new Date(progStart).getTime()) / 86400000) + 1;
                              return <p className="text-xs text-zinc-400">일 단가: {Math.round(progPayAmt / days).toLocaleString()}원/일</p>;
                            })()}
                          </div>
                        )}
                      </div>

                      {/* 추가/취소 */}
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={resetProgForm}
                          className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-500 hover:bg-zinc-50 transition">
                          취소
                        </button>
                        <button type="button" onClick={handleAddProg}
                          disabled={progPayAmt <= 0 || (progCat !== "헬스" && progCat !== "골프회원권" && progSessions <= 0)}
                          className="flex-[2] rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition">
                          프로그램 추가 ✓
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── 저장 / 취소 ── */}
            <div className="flex gap-3 pt-2 border-t border-zinc-100">
              <button onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-zinc-200 py-3 font-semibold text-zinc-600 hover:bg-zinc-50 transition">
                취소
              </button>
              <button onClick={handleSubmit} disabled={!form.name.trim()}
                className="flex-[2] rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 스타일 상수 ─────────────────────────────────────────────────────────────
const iCls =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
