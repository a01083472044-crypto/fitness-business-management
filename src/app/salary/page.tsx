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

type RoleType = "front" | "trainer" | "manager";
type EmpType  = "정규직" | "프리랜서";

const ROLE_INFO = {
  front:   { label: "프론트 데스크 / 운영 스태프", icon: "🖥️", color: "violet" },
  trainer: { label: "PT 트레이너",                  icon: "🏋️", color: "blue"   },
  manager: { label: "센터장 / 팀장",                icon: "👔", color: "amber"  },
};

function retentionBonus(base: number, rate: number): number {
  if (rate >= 90) return base * 0.35;
  if (rate >= 80) return base * 0.25;
  if (rate >= 70) return base * 0.15;
  if (rate >= 60) return base * 0.10;
  return 0;
}

function retentionGrade(rate: number) {
  if (rate >= 90) return { label: "최우수", color: "emerald", bonus: "기본급 35%" };
  if (rate >= 80) return { label: "우수",   color: "blue",    bonus: "기본급 25%" };
  if (rate >= 70) return { label: "양호",   color: "yellow",  bonus: "기본급 15%" };
  if (rate >= 60) return { label: "보통",   color: "orange",  bonus: "기본급 10%" };
  return           { label: "미달",   color: "zinc",    bonus: "성과급 없음" };
}

const IND_KEY = "gym_salary_individual";
function loadInd() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(IND_KEY) || "null"); } catch { return null; }
}

function IndividualCalc() {
  const saved = typeof window !== "undefined" ? loadInd() : null;

  const [role, setRole]         = useState<RoleType>(saved?.role ?? "trainer");
  const [empType, setEmpType]   = useState<EmpType>(saved?.empType ?? "정규직");
  const [baseSalary, setBaseRaw]= useState<string>(saved?.baseSalary ?? "");
  const [ptRevenue, setPtRaw]   = useState<string>(saved?.ptRevenue ?? "");
  const [commRate, setCommRate] = useState<string>(saved?.commRate ?? "50");
  const [retention, setRet]     = useState<string>(saved?.retention ?? "75");

  function p(patch: Record<string, string>) {
    const cur = loadInd() ?? {};
    localStorage.setItem(IND_KEY, JSON.stringify({ ...cur, ...patch }));
  }

  const setRole2 = (v: RoleType)  => { setRole(v);     p({ role: v }); };
  const setEmp2  = (v: EmpType)   => { setEmpType(v);  p({ empType: v }); };
  const setBase  = (v: string)    => { setBaseRaw(v);  p({ baseSalary: v }); };
  const setPt    = (v: string)    => { setPtRaw(v);    p({ ptRevenue: v }); };
  const setComm  = (v: string)    => { setCommRate(v); p({ commRate: v }); };
  const setRet2  = (v: string)    => { setRet(v);      p({ retention: v }); };

  const base      = parseKorean(baseSalary);
  const isFreelancer = empType === "프리랜서";

  let incentive   = 0;
  let grossSalary = 0;

  if (role === "front") {
    grossSalary = base;
  } else if (role === "trainer") {
    const rev = parseKorean(ptRevenue);
    incentive   = rev * (Number(commRate) / 100);
    grossSalary = base + incentive;
  } else if (role === "manager") {
    incentive   = retentionBonus(base, Number(retention));
    grossSalary = base + incentive;
  }

  // ✅ 정확한 사업자 실부담 계산
  // 정규직: 세전 × 1.09 (4대보험 사업자 부담분 9% 추가 납부)
  // 프리랜서: 세전 = 사업자 총비용 (3.3%는 세전에서 차감 후 사업자가 국세청에 대신 납부)
  //           → 프리랜서 실수령 = 세전 × 0.967 / 원천세 = 세전 × 0.033
  //           → 사업자 총지출 = 실수령 + 원천세 = 세전 × 1.0
  const companyCost     = isFreelancer ? grossSalary : grossSalary * 1.09;
  const freelancerNet   = isFreelancer ? grossSalary * 0.967 : 0; // 프리랜서 실수령
  const withholdingTax  = isFreelancer ? grossSalary * 0.033 : 0; // 원천세 (사업자 납부)

  const retGrade    = retentionGrade(Number(retention));

  const hasResult = grossSalary > 0;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-lg font-black text-zinc-900">직원 개별 급여 계산기</p>
        <p className="text-xs text-zinc-500 mt-0.5">직무별 고정급 + 성과급 혼합 구조 기반</p>
      </div>

      {/* 역할 선택 */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(ROLE_INFO) as [RoleType, typeof ROLE_INFO.front][]).map(([key, info]) => (
          <button key={key} onClick={() => setRole2(key)}
            className={`rounded-xl border p-3 text-center transition ${
              role === key
                ? "border-blue-500 bg-blue-50"
                : "border-zinc-200 bg-white hover:bg-zinc-50"
            }`}>
            <p className="text-xl mb-1">{info.icon}</p>
            <p className={`text-xs font-bold leading-tight ${role === key ? "text-blue-700" : "text-zinc-600"}`}>
              {key === "front"   ? "프론트\n데스크" :
               key === "trainer" ? "PT\n트레이너" : "센터장\n팀장"}
            </p>
          </button>
        ))}
      </div>

      {/* 역할 설명 */}
      <div className={`rounded-xl p-3 text-xs space-y-1 ${
        role === "front"   ? "bg-violet-50 text-violet-700" :
        role === "trainer" ? "bg-blue-50 text-blue-700"     : "bg-amber-50 text-amber-700"
      }`}>
        {role === "front" && <>
          <p className="font-bold">🖥️ 순수 고정급 구조</p>
          <p>운영 유지 역할이므로 성과급 연동 없이 안정적인 월급제가 적합합니다.</p>
        </>}
        {role === "trainer" && <>
          <p className="font-bold">🏋️ 기본지원금 + PT 매출 배분 구조</p>
          <p>국내 통상: 기본지원금 50~80만원 + PT 매출의 40~60% 배분</p>
          <p>매출 비중이 너무 높으면 단기 영업에만 집중되는 부작용이 발생합니다.</p>
        </>}
        {role === "manager" && <>
          <p className="font-bold">👔 기본급 + 조직 성과 연동 성과급</p>
          <p>개인 매출이 아닌 회원 유지율(Retention Rate) 기반 성과급이 권장됩니다.</p>
          <p className="text-xs opacity-80">출처: HFA 보고서, Two Brain Business</p>
        </>}
      </div>

      {/* 입력 폼 */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">

        {/* 고용 형태 (프론트/매니저는 정규직만) */}
        {role === "trainer" && (
          <div>
            <p className="text-xs font-semibold text-zinc-500 mb-2">고용 형태</p>
            <div className="flex gap-2">
              {(["정규직", "프리랜서"] as EmpType[]).map((t) => (
                <button key={t} onClick={() => setEmp2(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition border ${
                    empType === t
                      ? t === "정규직"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-zinc-500 border-zinc-200"
                  }`}>
                  {t}
                  <span className="ml-1 text-xs font-normal opacity-70">
                    {t === "정규직" ? "(4대보험)" : "(3.3%)"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 기본급 */}
        <NumInput
          label={role === "trainer" ? "기본지원금 (월)" : "기본급 (월)"}
          value={baseSalary}
          onChange={setBase}
          hint={role === "trainer" ? "국내 통상 50~80만원 수준" : undefined}
        />

        {/* PT 트레이너 전용 */}
        {role === "trainer" && (
          <>
            <NumInput label="이 트레이너의 이번달 PT 매출" value={ptRevenue} onChange={setPt} />
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                매출 배분율: <span className="text-blue-600 font-bold">{commRate}%</span>
              </label>
              <input type="range" min="30" max="70" value={commRate}
                onChange={(e) => setComm(e.target.value)}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-zinc-400 mt-1">
                <span>30%</span>
                <span className="text-blue-600">40~60% 권장</span>
                <span>70%</span>
              </div>
            </div>
          </>
        )}

        {/* 센터장 전용 */}
        {role === "manager" && (
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
              이번달 회원 유지율 (Retention Rate): <span className="text-amber-600 font-bold">{retention}%</span>
            </label>
            <input type="range" min="40" max="100" value={retention}
              onChange={(e) => setRet2(e.target.value)}
              className="w-full accent-amber-500" />
            <div className="flex justify-between text-xs text-zinc-400 mt-1">
              <span>40%</span>
              <span className="text-yellow-600">70% 양호</span>
              <span className="text-emerald-600">90% 최우수</span>
              <span>100%</span>
            </div>
            {/* 유지율 등급 표시 */}
            <div className={`mt-2 rounded-lg px-3 py-2 flex items-center justify-between text-xs font-semibold ${
              retGrade.color === "emerald" ? "bg-emerald-50 text-emerald-700" :
              retGrade.color === "blue"    ? "bg-blue-50 text-blue-700"       :
              retGrade.color === "yellow"  ? "bg-yellow-50 text-yellow-700"   :
              retGrade.color === "orange"  ? "bg-orange-50 text-orange-700"   :
                                             "bg-zinc-100 text-zinc-500"
            }`}>
              <span>유지율 {retention}% → {retGrade.label}</span>
              <span>{retGrade.bonus}</span>
            </div>
          </div>
        )}
      </div>

      {/* 결과 */}
      {hasResult && (
        <div className="space-y-3">
          {/* 급여 구조 */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
            <p className="font-bold text-zinc-900 text-sm">급여 구조 내역</p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">기본급{role === "trainer" ? " (기본지원금)" : ""}</span>
                <span className="font-semibold text-zinc-800">{formatKRW(base)}</span>
              </div>

              {role === "trainer" && incentive > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">PT 인센티브 ({commRate}% 배분)</span>
                  <span className="font-semibold text-blue-600">{formatKRW(incentive)}</span>
                </div>
              )}

              {role === "manager" && incentive > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">성과급 (유지율 {retention}%)</span>
                  <span className="font-semibold text-amber-600">{formatKRW(incentive)}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-zinc-100 pt-2 font-bold">
                <span className="text-zinc-700">총 실수령액 (세전)</span>
                <span className="text-zinc-900">{formatKRW(grossSalary)}</span>
              </div>
            </div>
          </div>

          {/* 사업자 부담 총비용 */}
          <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-3">
            <div>
              <p className="text-sm text-zinc-400 mb-1">사업자 실부담 총비용</p>
              <p className="text-3xl font-black">{formatKRW(companyCost)}</p>
            </div>

            {/* 정규직: 4대보험 추가 납부 구조 */}
            {!isFreelancer && (
              <div className="border-t border-zinc-700 pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-zinc-300">
                  <span>직원 실수령 (세전)</span>
                  <span>{formatKRW(grossSalary)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>4대보험 사업자 부담 (9% 추가)</span>
                  <span>+ {formatKRW(grossSalary * 0.09)}</span>
                </div>
                <div className="flex justify-between text-zinc-500 text-xs pt-1 border-t border-zinc-700">
                  <span>계산식</span>
                  <span>{formatKRW(grossSalary)} × 1.09</span>
                </div>
              </div>
            )}

            {/* 프리랜서: 원천징수 차감 구조 */}
            {isFreelancer && (
              <div className="border-t border-zinc-700 pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-zinc-300">
                  <span>세전 합의 금액</span>
                  <span>{formatKRW(grossSalary)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>원천징수 차감 (3.3%)</span>
                  <span>− {formatKRW(withholdingTax)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>프리랜서 실수령액</span>
                  <span>{formatKRW(freelancerNet)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>사업자 → 국세청 원천세 납부</span>
                  <span>{formatKRW(withholdingTax)}</span>
                </div>
                <div className="flex justify-between text-zinc-500 text-xs pt-1 border-t border-zinc-700">
                  <span>실수령 + 원천세 = 사업자 총지출</span>
                  <span>{formatKRW(freelancerNet)} + {formatKRW(withholdingTax)} = {formatKRW(companyCost)}</span>
                </div>
              </div>
            )}
          </div>

          {/* 인센티브 비율 안내 (트레이너) */}
          {role === "trainer" && base > 0 && grossSalary > 0 && (
            <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p className="font-bold">📌 트레이너 급여 구조 분석</p>
              <p>기본급 비중: {((base / grossSalary) * 100).toFixed(0)}% / 인센티브 비중: {((incentive / grossSalary) * 100).toFixed(0)}%</p>
              <p className={`font-semibold mt-1 ${incentive / grossSalary > 0.7 ? "text-red-600" : "text-blue-700"}`}>
                {incentive / grossSalary > 0.7
                  ? "⚠️ 인센티브 비중이 70% 초과 — 단기 영업 집중 리스크가 높습니다"
                  : "✅ 기본급과 인센티브가 균형 잡힌 구조입니다"}
              </p>
            </div>
          )}

          {/* 매니저 성과급 기준표 */}
          {role === "manager" && (
            <div className="bg-zinc-50 rounded-xl p-4 text-xs text-zinc-600 space-y-1.5">
              <p className="font-bold text-zinc-700">📋 회원 유지율 성과급 기준표</p>
              {[
                { range: "90% 이상", label: "최우수", bonus: "기본급 × 35%", color: "text-emerald-600" },
                { range: "80~89%",   label: "우수",   bonus: "기본급 × 25%", color: "text-blue-600"    },
                { range: "70~79%",   label: "양호",   bonus: "기본급 × 15%", color: "text-yellow-600"  },
                { range: "60~69%",   label: "보통",   bonus: "기본급 × 10%", color: "text-orange-500"  },
                { range: "60% 미만", label: "미달",   bonus: "성과급 없음",   color: "text-zinc-400"    },
              ].map((row) => (
                <div key={row.range} className={`flex justify-between ${Number(retention) >= parseInt(row.range) ? "font-semibold" : ""}`}>
                  <span>{row.range} ({row.label})</span>
                  <span className={row.color}>{row.bonus}</span>
                </div>
              ))}
              <p className="text-zinc-400 mt-1">출처: HFA(Health & Fitness Association) 보고서</p>
            </div>
          )}
        </div>
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

  const perFull      = full > 0      ? fullBudget      / full      / 1.09  : 0;
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
                      <p className="text-xs text-zinc-400 mb-1">4대보험 포함 총비용</p>
                      <p className="font-black text-blue-700 text-lg">{formatKRW(perFull * 1.09)}</p>
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
              <p>· 정규직: 예산 ÷ 1.09 (4대보험 사업자 부담 9% 제외)</p>
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
