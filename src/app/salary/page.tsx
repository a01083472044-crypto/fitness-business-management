"use client";

import { useState } from "react";

function formatKRW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

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

const inputCls = "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm";

function NumInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const parsed = parseKorean(value);
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
        <input type="text" inputMode="text" placeholder="0 또는 만원" value={value}
          onChange={(e) => onChange(e.target.value)} className={inputCls + " pl-8"} />
      </div>
      {parsed > 0 && <p className="mt-1 text-xs font-medium text-blue-500">→ {parsed.toLocaleString("ko-KR")}원</p>}
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function CountInput({ label, value, onChange, unit, hint }: { label: string; value: string; onChange: (v: string) => void; unit: string; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">{label}</label>
      <div className="relative">
        <input type="number" min="0" placeholder="0" value={value}
          onChange={(e) => onChange(e.target.value)} className={inputCls + " pr-10"} />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">{unit}</span>
      </div>
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function GradeBar({ ratio }: { ratio: number }) {
  const grade =
    ratio === 0 ? null :
    ratio < 30  ? { label: "안전", color: "emerald", icon: "✅" } :
    ratio < 40  ? { label: "주의", color: "yellow",  icon: "⚠️" } :
                  { label: "위험", color: "red",     icon: "🔴" };
  if (!grade) return null;
  return (
    <div className={`rounded-xl p-3 flex items-center justify-between ${
      grade.color === "emerald" ? "bg-emerald-50" :
      grade.color === "yellow"  ? "bg-yellow-50"  : "bg-red-50"
    }`}>
      <span className="text-sm font-semibold flex items-center gap-1.5">
        {grade.icon} {grade.label}
      </span>
      <span className={`text-lg font-black ${
        grade.color === "emerald" ? "text-emerald-600" :
        grade.color === "yellow"  ? "text-yellow-600"  : "text-red-600"
      }`}>{ratio.toFixed(1)}%</span>
    </div>
  );
}

// ─── 개별 급여 계산기 ────────────────────────────────────────────────────────

type RoleType  = "front" | "trainer" | "manager";
type EmpType   = "정규직" | "프리랜서";
type SalaryType = "base+rate" | "rate" | "base+fixed";
type ManagerSalaryType = "fixed" | "base+rate" | "rate" | "base+fixed";

const ROLE_INFO = {
  front:   { label: "프론트 데스크 / 운영 스태프", icon: "🖥️", color: "violet" },
  trainer: { label: "PT 트레이너",                  icon: "🏋️", color: "blue"   },
  manager: { label: "센터장 / 팀장",                icon: "👔", color: "amber"  },
};

type CalcMode = "diagnose" | "newHire";

function diagGrade(ratio: number) {
  if (ratio <= 0) return null;
  return ratio < 20
    ? { icon: "✅", label: "매우 적정", desc: "인건비 부담 낮음 — 추가 채용 검토 가능",       bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-400" }
    : ratio < 30
    ? { icon: "✅", label: "적정",     desc: "업계 권장 범위 내 — 현 급여 구조 유지 가능",    bg: "bg-blue-50",    text: "text-blue-700",    bar: "bg-blue-400"    }
    : ratio < 40
    ? { icon: "⚠️", label: "주의",    desc: "권장 범위 상단 — 매출 증가 또는 구조 재검토 권장", bg: "bg-yellow-50",  text: "text-yellow-700",  bar: "bg-yellow-400"  }
    :              { icon: "🔴", label: "위험",    desc: "40% 초과 — 급여 구조 즉각 검토 필요",  bg: "bg-red-50",     text: "text-red-700",     bar: "bg-red-400"     };
}

const IND_KEY = "gym_salary_individual";
function loadInd() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(IND_KEY) || "null"); } catch { return null; }
}

function IndividualCalc() {
  const saved = typeof window !== "undefined" ? loadInd() : null;

  const [mode, setMode]           = useState<CalcMode>(saved?.mode ?? "diagnose");
  const [role, setRole]           = useState<RoleType>(saved?.role ?? "trainer");
  const [empType, setEmpType]     = useState<EmpType>(saved?.empType ?? "정규직");
  const [salaryType, setSalaryType]       = useState<SalaryType>(saved?.salaryType ?? "base+rate");
  const [mgrSalaryType, setMgrSalaryType] = useState<ManagerSalaryType>(saved?.mgrSalaryType ?? "fixed");
  const [baseSalary, setBaseRaw]          = useState<string>(saved?.baseSalary ?? "");
  const [mgrFixedSalary, setMgrFixedRaw] = useState<string>(saved?.mgrFixedSalary ?? "");
  const [ptRevenue, setPtRaw]             = useState<string>(saved?.ptRevenue ?? "");
  const [commRate, setCommRate]           = useState<string>(saved?.commRate ?? "50");
  const [mgrRevenue, setMgrRevenueRaw]    = useState<string>(saved?.mgrRevenue ?? "");
  const [mgrCommRate, setMgrCommRateRaw]  = useState<string>(saved?.mgrCommRate ?? "50");
  const [sessionFee, setFeeRaw]           = useState<string>(saved?.sessionFee ?? "");
  const [sessionCount, setCountRaw]       = useState<string>(saved?.sessionCount ?? "");
  const [mgrSessionFee, setMgrFeeRaw]     = useState<string>(saved?.mgrSessionFee ?? "");
  const [mgrSessionCount, setMgrCountRaw] = useState<string>(saved?.mgrSessionCount ?? "");
  const [centerRevenue, setCenterRevenueRaw] = useState<string>(saved?.centerRevenue ?? "");
  // 신규 채용 모드 전용
  const [nhRevenue, setNhRevenueRaw]   = useState<string>(saved?.nhRevenue ?? "");
  const [nhRatio, setNhRatio]          = useState<string>(saved?.nhRatio ?? "25");
  const [nhPtRevenue, setNhPtRevRaw]   = useState<string>(saved?.nhPtRevenue ?? "");
  const [nhBase, setNhBaseRaw]         = useState<string>(saved?.nhBase ?? "50만");

  function p(patch: Record<string, string>) {
    const cur = loadInd() ?? {};
    localStorage.setItem(IND_KEY, JSON.stringify({ ...cur, ...patch }));
  }

  const setMode2        = (v: CalcMode)         => { setMode(v);           p({ mode: v }); };
  const setRole2        = (v: RoleType)         => { setRole(v);           p({ role: v }); };
  const setEmp2         = (v: EmpType)          => { setEmpType(v);        p({ empType: v }); };
  const setSalType      = (v: SalaryType)       => { setSalaryType(v);     p({ salaryType: v }); };
  const setMgrSalType   = (v: ManagerSalaryType)=> { setMgrSalaryType(v); p({ mgrSalaryType: v }); };
  const setBase         = (v: string)           => { setBaseRaw(v);        p({ baseSalary: v }); };
  const setMgrFixed     = (v: string)           => { setMgrFixedRaw(v);    p({ mgrFixedSalary: v }); };
  const setPt           = (v: string)           => { setPtRaw(v);          p({ ptRevenue: v }); };
  const setComm         = (v: string)           => { setCommRate(v);       p({ commRate: v }); };
  const setMgrRevenue   = (v: string)           => { setMgrRevenueRaw(v);  p({ mgrRevenue: v }); };
  const setMgrCommRate  = (v: string)           => { setMgrCommRateRaw(v); p({ mgrCommRate: v }); };
  const setFee          = (v: string)           => { setFeeRaw(v);         p({ sessionFee: v }); };
  const setCount        = (v: string)           => { setCountRaw(v);       p({ sessionCount: v }); };
  const setMgrFee       = (v: string)           => { setMgrFeeRaw(v);      p({ mgrSessionFee: v }); };
  const setMgrCount     = (v: string)           => { setMgrCountRaw(v);    p({ mgrSessionCount: v }); };
  const setCenterRevenue= (v: string)           => { setCenterRevenueRaw(v); p({ centerRevenue: v }); };
  const setNhRevenue    = (v: string)           => { setNhRevenueRaw(v);   p({ nhRevenue: v }); };
  const setNhRatio2     = (v: string)           => { setNhRatio(v);        p({ nhRatio: v }); };
  const setNhPtRevenue  = (v: string)           => { setNhPtRevRaw(v);     p({ nhPtRevenue: v }); };
  const setNhBase       = (v: string)           => { setNhBaseRaw(v);      p({ nhBase: v }); };

  const base      = parseKorean(baseSalary);
  const fee       = parseKorean(sessionFee);
  const count     = Number(sessionCount) || 0;
  // 프론트/센터장은 항상 정규직 구조, 트레이너만 프리랜서 선택 가능
  const isFreelancer = role === "trainer" && empType === "프리랜서";

  let incentive   = 0;
  let grossSalary = 0;

  if (role === "front") {
    grossSalary = base;
  } else if (role === "trainer") {
    if (salaryType === "base+rate") {
      const rev = parseKorean(ptRevenue);
      incentive   = rev * (Number(commRate) / 100);
      grossSalary = base + incentive;
    } else if (salaryType === "rate") {
      const rev = parseKorean(ptRevenue);
      incentive   = rev * (Number(commRate) / 100);
      grossSalary = incentive;
    } else { // base+fixed
      incentive   = count * fee;
      grossSalary = base + incentive;
    }
  } else if (role === "manager") {
    const mgrRev  = parseKorean(mgrRevenue);
    const mgrFee  = parseKorean(mgrSessionFee);
    const mgrCnt  = Number(mgrSessionCount) || 0;
    if (mgrSalaryType === "fixed") {
      grossSalary = parseKorean(mgrFixedSalary);
    } else if (mgrSalaryType === "base+rate") {
      incentive   = mgrRev * (Number(mgrCommRate) / 100);
      grossSalary = base + incentive;
    } else if (mgrSalaryType === "rate") {
      incentive   = mgrRev * (Number(mgrCommRate) / 100);
      grossSalary = incentive;
    } else { // base+fixed
      incentive   = mgrCnt * mgrFee;
      grossSalary = base + incentive;
    }
  }

  // ✅ 정확한 사업자 실부담 계산
  // 정규직: 세전 × 1.1065 (4대보험+산재 사업자 부담 10.65% 추가)
  //   국민연금 4.5% + 건강보험 3.545% + 장기요양 0.4591% + 고용보험 1.15% + 산재 ~1.0%
  // 프리랜서: 세전 = 사업자 총비용 (3.3%는 세전에서 차감 후 사업자가 국세청에 대신 납부)
  //           → 프리랜서 실수령 = 세전 × 0.967 / 원천세 = 세전 × 0.033
  //           → 사업자 총지출 = 실수령 + 원천세 = 세전 × 1.0
  const INS_RATE        = 0.1065; // 4대보험 + 산재보험 사업자 부담률
  const companyCost     = isFreelancer ? grossSalary : grossSalary * (1 + INS_RATE);
  const freelancerNet   = isFreelancer ? grossSalary * 0.967 : 0; // 프리랜서 실수령
  const withholdingTax  = isFreelancer ? grossSalary * 0.033 : 0; // 원천세 (사업자 납부)

  const hasResult = grossSalary > 0;
  const cRev      = parseKorean(centerRevenue);
  const diagRatio = cRev > 0 && companyCost > 0 ? (companyCost / cRev) * 100 : 0;

  // 신규 채용
  const nhRev     = parseKorean(nhRevenue);
  const nhBudget  = nhRev * Number(nhRatio) / 100;
  const nhMaxGross= nhBudget > 0 ? (isFreelancer ? nhBudget : nhBudget / (1 + INS_RATE)) : 0;
  const nhPtRev   = parseKorean(nhPtRevenue);
  const nhBaseAmt = parseKorean(nhBase);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-lg font-black text-zinc-900">직원 적정 급여 책정기</p>
        <p className="text-xs text-zinc-500 mt-0.5">현직원 진단 · 신규 채용 급여 계산</p>
      </div>

      {/* 모드 선택 */}
      <div className="grid grid-cols-2 gap-2">
        {([
          { key: "diagnose", icon: "🔍", label: "현직원 급여 진단",    desc: "현 급여가 매출 대비 적정한지 확인" },
          { key: "newHire",  icon: "🆕", label: "신규 채용 급여 책정", desc: "지금 매출로 채용 가능한 급여 계산" },
        ] as { key: CalcMode; icon: string; label: string; desc: string }[]).map(({ key, icon, label, desc }) => (
          <button key={key} onClick={() => setMode2(key)}
            className={`rounded-xl border p-3 text-left transition ${mode === key ? "border-blue-500 bg-blue-50" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}>
            <p className="text-lg mb-0.5">{icon}</p>
            <p className={`text-xs font-bold ${mode === key ? "text-blue-700" : "text-zinc-700"}`}>{label}</p>
            <p className={`text-xs mt-0.5 ${mode === key ? "text-blue-500" : "text-zinc-400"}`}>{desc}</p>
          </button>
        ))}
      </div>

      {/* 역할 선택 (공통) */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(ROLE_INFO) as [RoleType, typeof ROLE_INFO.front][]).map(([key, info]) => (
          <button key={key} onClick={() => setRole2(key)}
            className={`rounded-xl border p-3 text-center transition ${role === key ? "border-blue-500 bg-blue-50" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}>
            <p className="text-xl mb-1">{info.icon}</p>
            <p className={`text-xs font-bold leading-tight ${role === key ? "text-blue-700" : "text-zinc-600"}`}>
              {key === "front" ? "프론트\n데스크" : key === "trainer" ? "PT\n트레이너" : "센터장\n팀장"}
            </p>
          </button>
        ))}
      </div>

      {/* 고용 형태 (트레이너만, 공통) */}
      {role === "trainer" && (
        <div className="flex gap-2">
          {(["정규직", "프리랜서"] as EmpType[]).map((t) => (
            <button key={t} onClick={() => setEmp2(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition border ${
                empType === t
                  ? t === "정규직" ? "bg-blue-600 text-white border-blue-600" : "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-zinc-500 border-zinc-200"
              }`}>
              {t} <span className="text-xs font-normal opacity-70">{t === "정규직" ? "(4대보험)" : "(3.3%)"}</span>
            </button>
          ))}
        </div>
      )}

      {/* ══ 현직원 급여 진단 모드 ══ */}
      {mode === "diagnose" && (
        <>
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">현재 급여 정보</p>

            {/* 트레이너 급여 구조 */}
            {role === "trainer" && (
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "base+rate", label: "기본급\n+배분율" },
                  { key: "rate",      label: "배분율\n만" },
                  { key: "base+fixed",label: "기본급\n+고정수업료" },
                ] as { key: SalaryType; label: string }[]).map(({ key, label }) => (
                  <button key={key} onClick={() => setSalType(key)}
                    className={`py-2 rounded-xl border text-xs font-semibold whitespace-pre-line transition ${salaryType === key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-500 border-zinc-200"}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* 매니저 급여 구조 */}
            {role === "manager" && (
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "fixed",      label: "고정급" },
                  { key: "base+rate",  label: "기본급\n+배분율" },
                  { key: "rate",       label: "배분율\n만" },
                  { key: "base+fixed", label: "기본급\n+고정수업료" },
                ] as { key: ManagerSalaryType; label: string }[]).map(({ key, label }) => (
                  <button key={key} onClick={() => setMgrSalType(key)}
                    className={`py-2 rounded-xl border text-xs font-semibold whitespace-pre-line transition ${mgrSalaryType === key ? "bg-amber-500 text-white border-amber-500" : "bg-white text-zinc-500 border-zinc-200"}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* 매니저 고정급 (별도 상태) */}
            {role === "manager" && mgrSalaryType === "fixed" && (
              <NumInput label="고정급 (월)" value={mgrFixedSalary} onChange={setMgrFixed} />
            )}

            {/* 기본급 (front / trainer / manager base+rate, base+fixed) */}
            {(role === "front" ||
              (role === "trainer" && (salaryType === "base+rate" || salaryType === "base+fixed")) ||
              (role === "manager" && (mgrSalaryType === "base+rate" || mgrSalaryType === "base+fixed"))) && (
              <NumInput
                label={role === "trainer" && salaryType !== "base+fixed" ? "기본지원금 (월)" : "기본급 (월)"}
                value={baseSalary} onChange={setBase}
                hint={role === "trainer" && salaryType !== "base+fixed" ? "국내 통상 50~80만원 수준" : undefined}
              />
            )}

            {/* 트레이너 배분율 */}
            {role === "trainer" && (salaryType === "base+rate" || salaryType === "rate") && (
              <>
                <NumInput label="이 트레이너의 이번달 PT 매출" value={ptRevenue} onChange={setPt} />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-500">매출 배분율</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min="1" max="100" value={commRate} onChange={(e) => setComm(e.target.value)}
                        className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm font-bold text-blue-600 text-center focus:outline-none focus:border-blue-500" />
                      <span className="text-sm font-bold text-blue-600">%</span>
                    </div>
                  </div>
                  <input type="range" min="30" max="70" value={commRate} onChange={(e) => setComm(e.target.value)} className="w-full accent-blue-600" />
                  <div className="flex justify-between text-xs text-zinc-400 mt-1"><span>30%</span><span className="text-blue-600">40~60% 권장</span><span>70%</span></div>
                </div>
              </>
            )}

            {/* 트레이너 고정수업료 */}
            {role === "trainer" && salaryType === "base+fixed" && (
              <div className="grid grid-cols-2 gap-3">
                <NumInput label="회당 고정수업료" value={sessionFee} onChange={setFee} />
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">완료 수업</label>
                  <div className="relative">
                    <input type="number" min="0" placeholder="0" value={sessionCount} onChange={(e) => setCount(e.target.value)} className={inputCls + " pr-8"} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">회</span>
                  </div>
                </div>
              </div>
            )}

            {/* 매니저 배분율 */}
            {role === "manager" && (mgrSalaryType === "base+rate" || mgrSalaryType === "rate") && (
              <>
                <NumInput label="이번달 매출 (센터 전체 또는 담당)" value={mgrRevenue} onChange={setMgrRevenue} />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-500">매출 배분율</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min="1" max="100" value={mgrCommRate} onChange={(e) => setMgrCommRate(e.target.value)}
                        className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm font-bold text-amber-600 text-center focus:outline-none focus:border-amber-500" />
                      <span className="text-sm font-bold text-amber-600">%</span>
                    </div>
                  </div>
                  <input type="range" min="5" max="50" value={mgrCommRate} onChange={(e) => setMgrCommRate(e.target.value)} className="w-full accent-amber-500" />
                  <div className="flex justify-between text-xs text-zinc-400 mt-1"><span>5%</span><span className="text-amber-600">10~20% 권장</span><span>50%</span></div>
                </div>
              </>
            )}

            {/* 매니저 고정수업료 */}
            {role === "manager" && mgrSalaryType === "base+fixed" && (
              <div className="grid grid-cols-2 gap-3">
                <NumInput label="회당 고정수업료" value={mgrSessionFee} onChange={setMgrFee} />
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5">완료 수업</label>
                  <div className="relative">
                    <input type="number" min="0" placeholder="0" value={mgrSessionCount} onChange={(e) => setMgrCount(e.target.value)} className={inputCls + " pr-8"} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">회</span>
                  </div>
                </div>
              </div>
            )}

            {/* 센터 매출 (진단 기준) */}
            <div className="border-t border-dashed border-zinc-200 pt-4">
              <NumInput label="📊 이번달 센터 전체 매출" value={centerRevenue} onChange={setCenterRevenue}
                hint="이 직원 급여가 매출 대비 적정한지 진단합니다" />
            </div>
          </div>

          {/* 진단 결과 */}
          {hasResult && (
            <div className="space-y-3">
              {/* 진단 카드 (PRIMARY) */}
              {cRev > 0 && (() => {
                const g = diagGrade(diagRatio);
                if (!g) return null;
                return (
                  <div className={`rounded-2xl p-5 space-y-3 ${g.bg}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-base font-black ${g.text}`}>{g.icon} {g.label}</p>
                        <p className={`text-xs mt-0.5 ${g.text}`}>{g.desc}</p>
                      </div>
                      <span className={`text-3xl font-black ${g.text}`}>{diagRatio.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-white/60 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-2.5 rounded-full ${g.bar}`} style={{ width: `${Math.min(diagRatio, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs opacity-60">
                      <span className={g.text}>0%</span><span className={g.text}>20%</span>
                      <span className={g.text}>30% 권장</span><span className={g.text}>40% ⚠️</span>
                    </div>
                    <div className={`rounded-xl bg-white/50 p-3 text-xs space-y-1.5 ${g.text}`}>
                      <div className="flex justify-between"><span>직원 세전 실수령</span><span className="font-bold">{formatKRW(grossSalary)}</span></div>
                      <div className="flex justify-between"><span>사업자 실부담 (4대보험 포함)</span><span className="font-bold">{formatKRW(companyCost)}</span></div>
                      {diagRatio >= 30 && (
                        <div className={`mt-1 p-2 rounded-lg bg-white/40 font-semibold`}>
                          💡 적정 급여 (30% 기준): {formatKRW(cRev * 0.3 / (isFreelancer ? 1 : 1 + INS_RATE))} 세전
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 매출 미입력 시 급여 내역 */}
              {cRev === 0 && (
                <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-2 text-sm">
                  <p className="font-bold text-zinc-700">급여 내역</p>
                  {(role !== "trainer" || salaryType !== "rate") && (role !== "manager" || mgrSalaryType !== "rate") && (
                    <div className="flex justify-between text-zinc-600">
                      <span>{role === "trainer" && salaryType !== "base+fixed" ? "기본지원금" : role === "manager" && mgrSalaryType === "fixed" ? "고정급" : "기본급"}</span>
                      <span>{formatKRW(role === "manager" && mgrSalaryType === "fixed" ? parseKorean(mgrFixedSalary) : base)}</span>
                    </div>
                  )}
                  {incentive > 0 && <div className="flex justify-between text-blue-600"><span>인센티브</span><span>{formatKRW(incentive)}</span></div>}
                  <div className="flex justify-between font-bold border-t border-zinc-100 pt-2"><span>세전 실수령</span><span>{formatKRW(grossSalary)}</span></div>
                  <div className="flex justify-between text-zinc-500"><span>사업자 실부담</span><span className="font-bold text-zinc-800">{formatKRW(companyCost)}</span></div>
                  <p className="text-xs text-zinc-400 text-center pt-1">↑ 센터 매출 입력 시 적정 여부 자동 진단</p>
                </div>
              )}

              {/* 트레이너 구조 분석 */}
              {role === "trainer" && salaryType !== "base+fixed" && base > 0 && grossSalary > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1">
                  <p className="font-bold">📌 급여 구조 분석</p>
                  <p>기본지원금 {((base / grossSalary) * 100).toFixed(0)}% / 인센티브 {((incentive / grossSalary) * 100).toFixed(0)}%</p>
                  <p className={`font-semibold ${incentive / grossSalary > 0.7 ? "text-red-600" : "text-blue-700"}`}>
                    {incentive / grossSalary > 0.7 ? "⚠️ 인센티브 비중 70% 초과 — 단기 영업 집중 리스크" : "✅ 기본급·인센티브 균형 잡힌 구조"}
                  </p>
                </div>
              )}

              {/* 프리랜서 지급 구조 */}
              {isFreelancer && (
                <div className="bg-zinc-900 rounded-2xl p-4 text-white text-sm space-y-1.5">
                  <p className="text-zinc-400 text-xs mb-1">프리랜서 지급 구조</p>
                  <div className="flex justify-between text-zinc-300"><span>세전 합의 금액</span><span>{formatKRW(grossSalary)}</span></div>
                  <div className="flex justify-between text-zinc-400"><span>원천징수 (3.3%)</span><span>− {formatKRW(withholdingTax)}</span></div>
                  <div className="flex justify-between text-emerald-400 font-semibold"><span>실수령</span><span>{formatKRW(freelancerNet)}</span></div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══ 신규 채용 급여 책정 모드 ══ */}
      {mode === "newHire" && (
        <>
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">현재 매출 기준 채용 가능 급여</p>

            <NumInput label="이번달 센터 전체 매출" value={nhRevenue} onChange={setNhRevenue} />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-500">이 직원에게 배정할 인건비 비율</label>
                <div className="flex items-center gap-1">
                  <input type="number" min="1" max="60" value={nhRatio} onChange={(e) => setNhRatio2(e.target.value)}
                    className="w-14 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm font-bold text-blue-600 text-center focus:outline-none focus:border-blue-500" />
                  <span className="text-sm font-bold text-blue-600">%</span>
                </div>
              </div>
              <input type="range" min="5" max="50" value={nhRatio} onChange={(e) => setNhRatio2(e.target.value)} className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-zinc-400 mt-1">
                <span>5%</span><span className="text-emerald-600">20% 적정</span><span className="text-yellow-600">30% 한도</span><span className="text-red-500">50%</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">전체 인건비 합산 30% 이하 권장 (1인 기준 배정 비율)</p>
            </div>

            {/* 트레이너 시뮬레이션 옵션 */}
            {role === "trainer" && nhRev > 0 && (
              <div className="border-t border-dashed border-zinc-200 pt-3 space-y-3">
                <p className="text-xs font-semibold text-zinc-400">📌 구조 시뮬레이션 (선택)</p>
                <NumInput label="예상 이 트레이너의 월 PT 매출" value={nhPtRevenue} onChange={setNhPtRevenue} hint="기본급+배분율 구조 계산용" />
                <NumInput label="제안할 기본지원금" value={nhBase} onChange={setNhBase} hint="통상 50~80만원" />
              </div>
            )}
          </div>

          {/* 신규 채용 결과 */}
          {nhRev > 0 && nhBudget > 0 && (
            <div className="space-y-3">
              <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-3">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">사업자 최대 배정 예산</p>
                  <p className="text-3xl font-black">{formatKRW(nhBudget)}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{formatKRW(nhRev)} × {nhRatio}%</p>
                </div>
                <div className="border-t border-zinc-700 pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-zinc-300">
                    <span>직원 최대 세전 실수령</span>
                    <span className="font-bold text-white">{formatKRW(nhMaxGross)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>{isFreelancer ? "원천징수 3.3%" : "4대보험+산재 10.65%"}</span>
                    <span>{isFreelancer ? `− ${formatKRW(nhMaxGross * 0.033)}` : `+ ${formatKRW(nhMaxGross * INS_RATE)}`}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
                <p className="text-sm font-bold text-zinc-800">📋 급여 구조 예시</p>

                {role === "front" && (
                  <div className="rounded-xl bg-violet-50 p-3 text-xs text-violet-700 space-y-1">
                    <p className="font-bold">고정급 구조</p>
                    <p>월 {formatKRW(nhMaxGross)} (세전) 지급 가능</p>
                  </div>
                )}

                {role === "trainer" && (
                  <div className="space-y-2">
                    <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700 space-y-1">
                      <p className="font-bold">① 기본지원금 + 배분율 (권장)</p>
                      {nhPtRev > 0 && nhBaseAmt > 0 ? (() => {
                        const expectedIncentive = nhMaxGross - nhBaseAmt;
                        const recRate = Math.round((expectedIncentive / nhPtRev) * 100);
                        return <><p>기본지원금 {formatKRW(nhBaseAmt)} + PT 매출의 {recRate}% 배분</p><p className="opacity-70">예상 인센티브 {formatKRW(expectedIncentive)} | 합계 {formatKRW(nhMaxGross)}</p></>;
                      })() : <p>기본지원금 50~80만원 + 나머지를 PT 매출 배분으로 구성 (↑ 예상 매출·기본급 입력 시 배분율 자동 계산)</p>}
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 space-y-1">
                      <p className="font-bold">② 순수 배분율</p>
                      {nhPtRev > 0 ? <p>PT 매출의 {Math.round((nhMaxGross / nhPtRev) * 100)}% 배분 → 월 {formatKRW(nhMaxGross)} (세전)</p> : <p>예상 PT 매출 입력 시 배분율 계산</p>}
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 space-y-1">
                      <p className="font-bold">③ 기본급 + 고정수업료</p>
                      <p>기본급 50만원 + 회당 {formatKRW(Math.round((nhMaxGross - 500000) / 30))} (월 30회 기준)</p>
                    </div>
                  </div>
                )}

                {role === "manager" && (
                  <div className="space-y-2">
                    <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 space-y-1">
                      <p className="font-bold">① 고정급 구조</p>
                      <p>월 {formatKRW(nhMaxGross)} (세전) 고정 지급 가능</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 space-y-1">
                      <p className="font-bold">② 기본급 + 매출 배분율</p>
                      <p>기본급 {formatKRW(Math.round(nhMaxGross * 0.7))} + 센터 매출의 10~20% 성과급</p>
                    </div>
                  </div>
                )}

                <div className={`rounded-xl p-3 text-xs ${Number(nhRatio) <= 20 ? "bg-emerald-50 text-emerald-700" : Number(nhRatio) <= 30 ? "bg-blue-50 text-blue-700" : Number(nhRatio) <= 40 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"}`}>
                  <p className="font-bold">
                    {Number(nhRatio) <= 20 ? "✅ 채용 여력 충분" : Number(nhRatio) <= 30 ? "✅ 적정 채용 수준" : Number(nhRatio) <= 40 ? "⚠️ 다른 직원 인건비도 합산 확인 필요" : "🔴 1인에게 매출의 40% 이상 — 전체 인건비 점검 필요"}
                  </p>
                  <p className="mt-0.5 opacity-80">전체 인건비 합산이 매출의 30%를 초과하지 않도록 관리하세요</p>
                </div>
              </div>
            </div>
          )}

          {nhRev === 0 && (
            <p className="text-center text-sm text-zinc-400 py-4">센터 매출을 입력하면 채용 가능 급여가 계산됩니다</p>
          )}
        </>
      )}
    </section>
  );
}

// ─── localStorage 키 ─────────────────────────────────────────────────────────

const STORAGE_KEY = "gym_salary_calc";

function loadSaved() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function SalaryPage() {
  const saved = typeof window !== "undefined" ? loadSaved() : null;
  const [actualRevenue, setActualRevenueRaw] = useState(saved?.actualRevenue ?? "");
  const [fullCount, setFullCountRaw]         = useState(saved?.fullCount ?? "");
  const [freelanceCount, setFreeanceCountRaw]= useState(saved?.freelanceCount ?? "");
  const [targetRatio, setTargetRatioRaw]     = useState(saved?.targetRatio ?? "35");

  function persist(patch: Record<string, string>) {
    const cur = loadSaved() ?? {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...patch }));
  }

  const setActualRevenue = (v: string) => { setActualRevenueRaw(v); persist({ actualRevenue: v }); };
  const setFullCount     = (v: string) => { setFullCountRaw(v);     persist({ fullCount: v }); };
  const setFreeanceCount = (v: string) => { setFreeanceCountRaw(v); persist({ freelanceCount: v }); };
  const setTargetRatio   = (v: string) => { setTargetRatioRaw(v);   persist({ targetRatio: v }); };

  const revenue = parseKorean(actualRevenue);
  const full = Number(fullCount) || 0;
  const freelance = Number(freelanceCount) || 0;
  const ratio = Number(targetRatio) / 100;

  const totalLaborBudget = revenue * ratio;
  const fullBudget = full + freelance > 0 ? totalLaborBudget * (full / (full + freelance * 0.7)) : 0;
  const freelanceBudget = full + freelance > 0 ? totalLaborBudget - fullBudget : 0;

  const EMPLOYER_INS = 1.1065; // 4대보험+산재 사업자 부담 10.65%
  const perFull      = full > 0      ? fullBudget      / full      / EMPLOYER_INS  : 0;
  const perFreelance = freelance > 0 ? freelanceBudget / freelance / 1.033 : 0;

  const currentLaborRatio = revenue > 0 ? (totalLaborBudget / revenue) * 100 : 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">적정 급여 계산기</h1>
          <p className="text-sm text-zinc-500 mt-0.5">실소진매출 기준 지급 가능한 최대 급여를 계산합니다</p>
        </div>

        {/* 기준 안내 */}
        <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700 space-y-1">
          <p className="font-bold">📚 업계 권장 기준</p>
          <p>인건비 비율 <strong>30% 이하</strong> → 안전 (수익성 확보)</p>
          <p>인건비 비율 <strong>30~40%</strong> → 주의 (모니터링 필요)</p>
          <p>인건비 비율 <strong>40% 초과</strong> → 위험 (즉각 검토 필요)</p>
          <p className="text-xs text-blue-500 mt-1">출처: ISSA, Two Brain Business, KB금융 피트니스 업계 분석</p>
        </div>

        {/* ── 전체 인건비 예산 ── */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">전체 인건비 예산 계산</p>
          <NumInput label="이번달 실소진매출" value={actualRevenue} onChange={setActualRevenue}
            hint="총 결제금액이 아닌 실제 진행된 수업 기준 매출" />
          <div className="grid grid-cols-2 gap-3">
            <CountInput label="정규직 트레이너" value={fullCount} onChange={setFullCount} unit="명" />
            <CountInput label="프리랜서 트레이너" value={freelanceCount} onChange={setFreeanceCount} unit="명" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
              목표 인건비 비율: <span className="text-blue-600">{targetRatio}%</span>
            </label>
            <input type="range" min="20" max="55" value={targetRatio}
              onChange={(e) => setTargetRatio(e.target.value)}
              className="w-full accent-blue-600" />
            <div className="flex justify-between text-xs text-zinc-400 mt-1">
              <span>20% (보수적)</span>
              <span className="text-emerald-600">30% 권장</span>
              <span className="text-yellow-600">40% 경고</span>
              <span>55%</span>
            </div>
          </div>
        </section>

        {revenue > 0 && (full + freelance > 0) && (
          <section className="space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">전체 예산 결과</p>

            <GradeBar ratio={currentLaborRatio} />

            <div className="bg-zinc-900 rounded-2xl p-5 text-white">
              <p className="text-sm text-zinc-400 mb-1">총 인건비 예산</p>
              <p className="text-3xl font-black text-white">{formatKRW(totalLaborBudget)}</p>
              <p className="text-xs text-zinc-500 mt-1">실소진매출 {formatKRW(revenue)} × {targetRatio}%</p>
            </div>

            <div className="space-y-3">
              {full > 0 && (
                <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">정규직</span>
                    <span className="text-sm text-zinc-500">{full}명 기준</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">1인당 실수령 (세전)</p>
                      <p className="font-black text-zinc-900 text-lg">{formatKRW(perFull)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">4대보험+산재 포함 총비용</p>
                      <p className="font-black text-blue-700 text-lg">{formatKRW(perFull * EMPLOYER_INS)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400">정규직 총 인건비 예산: {formatKRW(fullBudget)}</p>
                </div>
              )}

              {freelance > 0 && (
                <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">프리랜서</span>
                    <span className="text-sm text-zinc-500">{freelance}명 기준</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">1인당 실수령 (세전)</p>
                      <p className="font-black text-zinc-900 text-lg">{formatKRW(perFreelance)}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 mb-1">원천징수 포함 총비용</p>
                      <p className="font-black text-emerald-700 text-lg">{formatKRW(perFreelance * 1.033)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400">프리랜서 총 인건비 예산: {formatKRW(freelanceBudget)}</p>
                </div>
              )}
            </div>

            <div className="bg-zinc-50 rounded-xl p-4 text-xs text-zinc-500 space-y-1">
              <p className="font-semibold text-zinc-700">📌 계산 기준</p>
              <p>· 정규직: 예산 ÷ 1.1065 (4대보험+산재 사업자 부담 10.65% 제외)</p>
              <p>· 프리랜서: 예산 ÷ 1.033 (원천징수 3.3% 제외)</p>
              <p>· 정규직:프리랜서 예산 배분 = 인원비 기준 가중 분배</p>
            </div>
          </section>
        )}

        {revenue > 0 && full + freelance === 0 && (
          <p className="text-center text-sm text-zinc-400">트레이너 인원수를 입력하세요</p>
        )}

        {/* ── 구분선 ── */}
        <div className="border-t border-zinc-200" />

        {/* ── 개별 급여 계산기 ── */}
        <IndividualCalc />
      </div>
    </div>
  );
}
