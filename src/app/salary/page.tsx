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

export default function SalaryPage() {
  const [actualRevenue, setActualRevenue] = useState("");
  const [fullCount, setFullCount] = useState("");
  const [freelanceCount, setFreeanceCount] = useState("");
  const [targetRatio, setTargetRatio] = useState("35");

  const revenue = parseKorean(actualRevenue);
  const full = Number(fullCount) || 0;
  const freelance = Number(freelanceCount) || 0;
  const ratio = Number(targetRatio) / 100;

  const totalLaborBudget = revenue * ratio;
  // 정규직: 4대보험 9% 포함이므로 실수령 = 예산 / 1.09
  const fullBudget = full + freelance > 0 ? totalLaborBudget * (full / (full + freelance * 0.7)) : 0;
  const freelanceBudget = full + freelance > 0 ? totalLaborBudget - fullBudget : 0;

  const perFull = full > 0 ? fullBudget / full / 1.09 : 0;           // 4대보험 제외 실지급
  const perFreelance = freelance > 0 ? freelanceBudget / freelance / 1.033 : 0; // 원천징수 제외 실지급

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

        {/* 입력 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">매출 · 인원 입력</p>
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

        {/* 결과 */}
        {revenue > 0 && (full + freelance > 0) && (
          <section className="space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">계산 결과</p>

            <GradeBar ratio={currentLaborRatio} />

            {/* 총 인건비 예산 */}
            <div className="bg-zinc-900 rounded-2xl p-5 text-white">
              <p className="text-sm text-zinc-400 mb-1">총 인건비 예산</p>
              <p className="text-3xl font-black text-white">{formatKRW(totalLaborBudget)}</p>
              <p className="text-xs text-zinc-500 mt-1">실소진매출 {formatKRW(revenue)} × {targetRatio}%</p>
            </div>

            {/* 1인당 지급 가능 금액 */}
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
      </div>
    </div>
  );
}
