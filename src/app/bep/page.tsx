"use client";

import { useState, useEffect } from "react";
import { getCosts, currentMonth } from "../lib/store";

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

function NumInput({ label, value, onChange, hint, linked }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; linked?: boolean;
}) {
  const parsed = parseKorean(value);
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 mb-1.5 flex items-center gap-1.5">
        {label}
        {linked && <span className="text-blue-400 text-xs font-normal">· 비용관리 연동</span>}
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
        <input type="text" inputMode="text" placeholder="0 또는 만원" value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls + " pl-8" + (linked ? " border-blue-200 bg-blue-50/30" : "")} />
      </div>
      {parsed > 0 && <p className="mt-1 text-xs font-medium text-blue-500">→ {parsed.toLocaleString("ko-KR")}원</p>}
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export default function BepPage() {
  const [month, setMonth] = useState(currentMonth());
  const [linked, setLinked] = useState(false);

  // 고정비
  const [rent, setRent] = useState("");
  const [salary, setSalary] = useState("");
  const [freelance, setFreelance] = useState("");
  const [utilities, setUtilities] = useState("");
  const [depreciation, setDepreciation] = useState("");
  const [otherFixed, setOtherFixed] = useState("");

  // 변동비
  const [supplies, setSupplies] = useState("");
  const [marketing, setMarketing] = useState("");
  const [otherVariable, setOtherVariable] = useState("");

  // 세금
  const [isVat, setIsVat] = useState(false);
  // 현재 매출
  const [currentRevenue, setCurrentRevenue] = useState("");

  // 비용 관리 데이터 자동 연동
  useEffect(() => {
    const all = getCosts();
    const found = all.find((c) => c.month === month);
    if (found) {
      setRent(found.rent > 0 ? String(found.rent) : "");
      setSalary(found.trainerSalary > 0 ? String(found.trainerSalary) : "");
      setFreelance(found.freelanceSalary > 0 ? String(found.freelanceSalary) : "");
      setUtilities((found.utilities + found.communication) > 0 ? String(found.utilities + found.communication) : "");
      setDepreciation(found.depreciation > 0 ? String(found.depreciation) : "");
      setOtherFixed(found.otherFixed > 0 ? String(found.otherFixed) : "");
      setSupplies(found.supplies > 0 ? String(found.supplies) : "");
      setMarketing(found.marketing > 0 ? String(found.marketing) : "");
      setOtherVariable(found.otherVariable > 0 ? String(found.otherVariable) : "");
      setIsVat(found.isVat);
      setLinked(true);
    } else {
      setLinked(false);
    }
  }, [month]);

  const fixedCost =
    parseKorean(rent) +
    parseKorean(salary) * 1.09 +
    parseKorean(freelance) * 1.033 +
    parseKorean(utilities) +
    parseKorean(depreciation) +
    parseKorean(otherFixed);

  const variableCost =
    parseKorean(supplies) +
    parseKorean(marketing) +
    parseKorean(otherVariable);

  const totalMonthlyCost = fixedCost + variableCost;
  const taxRatio = (isVat ? 0.1 : 0) + 0.033;
  const bep = (1 - taxRatio) > 0 ? totalMonthlyCost / (1 - taxRatio) : 0;

  const revenue = parseKorean(currentRevenue);
  const gap = revenue - bep;
  const achieveRatio = bep > 0 ? (revenue / bep) * 100 : 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">손익분기점 계산기</h1>
            <p className="text-sm text-zinc-500 mt-0.5">이 센터가 흑자가 되려면 얼마를 벌어야 하는지 계산합니다</p>
          </div>
          <input
            type="month" value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 연동 상태 */}
        {linked ? (
          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-blue-700">
            <span>🔗</span>
            <span><strong>{month}</strong> 비용 관리 데이터가 자동으로 연동됐습니다. 수정도 가능합니다.</span>
          </div>
        ) : (
          <div className="bg-zinc-100 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-zinc-500">
            <span>ℹ️</span>
            <span>비용 관리에 해당 월 데이터가 없습니다. 직접 입력하세요.</span>
          </div>
        )}

        {/* 개념 안내 */}
        <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700 space-y-1">
          <p className="font-bold">📚 손익분기점(BEP)이란?</p>
          <p>총 수익 = 총 비용이 되는 매출 지점. 이 이상 벌어야 순이익이 발생합니다.</p>
          <p className="font-semibold mt-1">BEP = 월 총비용 ÷ (1 - 세금율)</p>
          <p className="text-xs text-blue-500 mt-1">출처: 관리회계 표준 공헌이익법 (Contribution Margin Method)</p>
        </div>

        {/* 고정비 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">월 고정비</p>
          <NumInput label="임차료 (월세)" value={rent} onChange={setRent} linked={linked && parseKorean(rent) > 0} />
          <NumInput label="정규직 인건비 합계 (세전)" value={salary} onChange={setSalary}
            hint="4대보험(9%)은 자동 추가됩니다" linked={linked && parseKorean(salary) > 0} />
          <NumInput label="프리랜서 인건비 합계 (세전)" value={freelance} onChange={setFreelance}
            hint="원천징수(3.3%)는 자동 추가됩니다" linked={linked && parseKorean(freelance) > 0} />
          <NumInput label="공과금 · 통신비" value={utilities} onChange={setUtilities} linked={linked && parseKorean(utilities) > 0} />
          <NumInput label="감가상각비 (월)" value={depreciation} onChange={setDepreciation} linked={linked && parseKorean(depreciation) > 0} />
          <NumInput label="기타 고정비" value={otherFixed} onChange={setOtherFixed} linked={linked && parseKorean(otherFixed) > 0} />
          {fixedCost > 0 && (
            <div className="rounded-xl bg-zinc-50 px-4 py-3 flex justify-between text-sm">
              <span className="text-zinc-500">고정비 합계 (4대보험·원천징수 포함)</span>
              <span className="font-bold text-zinc-900">{formatKRW(fixedCost)}</span>
            </div>
          )}
        </section>

        {/* 변동비 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">월 변동비</p>
          <NumInput label="소모품비" value={supplies} onChange={setSupplies} linked={linked && parseKorean(supplies) > 0} />
          <NumInput label="마케팅 / 광고비" value={marketing} onChange={setMarketing} linked={linked && parseKorean(marketing) > 0} />
          <NumInput label="기타 변동비" value={otherVariable} onChange={setOtherVariable} linked={linked && parseKorean(otherVariable) > 0} />
          {variableCost > 0 && (
            <div className="rounded-xl bg-zinc-50 px-4 py-3 flex justify-between text-sm">
              <span className="text-zinc-500">변동비 합계</span>
              <span className="font-bold text-zinc-900">{formatKRW(variableCost)}</span>
            </div>
          )}
        </section>

        {/* 세금 설정 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">세금 설정</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-900 text-sm">부가세 과세 사업자</p>
              <p className="text-xs text-zinc-400">실소진매출의 10% 추가</p>
            </div>
            <button onClick={() => setIsVat(!isVat)}
              className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative overflow-hidden ${isVat ? "bg-blue-600" : "bg-zinc-200"}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isVat ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          {totalMonthlyCost > 0 && (
            <div className="rounded-xl bg-zinc-50 px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">월 총비용 (고정비 + 변동비)</span>
                <span className="font-bold text-zinc-900">{formatKRW(totalMonthlyCost)}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>세금율 (종합소득세 3.3%{isVat ? " + 부가세 10%" : ""})</span>
                <span>{(taxRatio * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </section>

        {/* BEP 결과 */}
        {bep > 0 && (
          <section className="space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">손익분기점</p>
            <div className="bg-zinc-900 rounded-2xl p-5 text-white">
              <p className="text-sm text-zinc-400 mb-1">이 센터의 월 BEP 매출</p>
              <p className="text-3xl font-black text-white">{formatKRW(bep)}</p>
              <p className="text-xs text-zinc-500 mt-2">실소진매출 기준으로 이 금액 이상 달성해야 흑자입니다</p>
            </div>

            {/* 현재 매출 비교 */}
            <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
              <p className="font-bold text-zinc-900">현재 매출과 비교</p>
              <NumInput label="이번달 실소진매출" value={currentRevenue} onChange={setCurrentRevenue} />
              {revenue > 0 && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                      <span>BEP 달성률</span>
                      <span className="font-bold">{achieveRatio.toFixed(1)}%</span>
                    </div>
                    <div className="h-4 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          achieveRatio >= 100 ? "bg-emerald-500" :
                          achieveRatio >= 70  ? "bg-yellow-400" : "bg-red-400"
                        }`}
                        style={{ width: `${Math.min(achieveRatio, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                      <span>0</span>
                      <span className="text-zinc-600 font-semibold">BEP {formatKRW(bep)}</span>
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 ${gap >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                    <p className={`font-bold text-lg ${gap >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {gap >= 0 ? "✅ BEP 달성!" : "🔴 BEP 미달"}
                    </p>
                    <p className={`text-sm mt-1 ${gap >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {gap >= 0
                        ? `BEP 초과 ${formatKRW(gap)} → 이 금액이 순이익 재원`
                        : `BEP까지 ${formatKRW(Math.abs(gap))} 부족`}
                    </p>
                  </div>
                  <div className="bg-zinc-50 rounded-xl p-4 space-y-2 text-sm">
                    {[
                      { label: "실소진매출", value: revenue },
                      { label: "세금 차감", value: -(revenue * taxRatio) },
                      { label: "고정비 차감", value: -fixedCost },
                      { label: "변동비 차감", value: -variableCost },
                      { label: "순이익", value: revenue - revenue * taxRatio - fixedCost - variableCost, bold: true },
                    ].map(({ label, value, bold }) => (
                      <div key={label} className={`flex justify-between ${bold ? "border-t border-zinc-200 pt-2 font-bold" : ""}`}>
                        <span className={bold ? "text-zinc-900" : "text-zinc-500"}>{label}</span>
                        <span className={`font-semibold ${value < 0 ? "text-red-600" : value > 0 && bold ? "text-emerald-600" : "text-zinc-800"}`}>
                          {formatKRW(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </div>
  );
}
