"use client";

import { useState, useEffect, ChangeEvent } from "react";
import React from "react";
import { getCosts, saveCosts, emptyCosts, currentMonth, MonthlyCosts, getBranches, getTrainers } from "../lib/store";

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

const inputCls =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm";

function NumField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  const [raw, setRaw] = useState(value > 0 ? String(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value);
    onChange(parseKorean(e.target.value));
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
        <input
          type="text"
          inputMode="text"
          placeholder="0 또는 만원"
          value={raw}
          onChange={handleChange}
          className={inputCls + " pl-8"}
        />
      </div>
      {parseKorean(raw) > 0 && (
        <p className="mt-1 text-xs font-medium text-blue-500">→ {parseKorean(raw).toLocaleString("ko-KR")}원</p>
      )}
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export default function CostsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [costs, setCosts] = useState<MonthlyCosts>(emptyCosts(currentMonth()));
  const [saved, setSaved] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");

  useEffect(() => {
    const saved = getBranches();
    const trainerBranches = getTrainers()
      .map((t) => t.branch)
      .filter(Boolean);
    const merged = Array.from(new Set([...saved, ...trainerBranches]));
    setBranches(merged);
  }, []);

  useEffect(() => {
    const all = getCosts();
    const found = all.find((c) => c.month === month && (c.branch ?? "") === selectedBranch);
    setCosts(found ?? emptyCosts(month, selectedBranch));
    setSaved(false);
  }, [month, selectedBranch]);

  const update = <K extends keyof MonthlyCosts>(key: K, val: MonthlyCosts[K]) => {
    setCosts((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = () => {
    const all = getCosts();
    const idx = all.findIndex((c) => c.month === month && (c.branch ?? "") === selectedBranch);
    if (idx >= 0) all[idx] = costs;
    else all.push(costs);
    saveCosts(all);
    setSaved(true);
  };

  const totalFixed =
    costs.rent + (costs.managementFee ?? 0) +
    costs.trainerSalary + costs.trainerSalary * 0.1065 +
    costs.freelanceSalary + costs.freelanceSalary * 0.033 +
    costs.utilities + costs.communication + costs.depreciation + costs.otherFixed;
  const totalVariable = costs.supplies + costs.marketing + (costs.parkingFee ?? 0) + (costs.paymentFee ?? 0) + costs.otherVariable;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">비용 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">월별 고정비 · 변동비 입력</p>
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 지점 탭 */}
        {branches.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ label: "전체", value: "" }, ...branches.map((b) => ({ label: b, value: b }))].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setSelectedBranch(value)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  selectedBranch === value
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-zinc-200 text-zinc-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 고정비 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">고정비</p>
          <NumField label="임차료 (월세)" value={costs.rent} onChange={(v) => update("rent", v)} />
          <NumField label="관리비" value={costs.managementFee ?? 0} onChange={(v) => update("managementFee", v)} />
          <NumField label="정규직 인건비 합계" value={costs.trainerSalary} onChange={(v) => update("trainerSalary", v)} hint="4대보험(10.65%)은 자동 계산됩니다" />
          <NumField label="프리랜서 인건비 합계" value={costs.freelanceSalary} onChange={(v) => update("freelanceSalary", v)} hint="원천징수(3.3%)는 자동 계산됩니다" />
          <NumField label="공과금" value={costs.utilities} onChange={(v) => update("utilities", v)} />
          <NumField label="통신비" value={costs.communication} onChange={(v) => update("communication", v)} />
          <NumField label="감가상각비 (월)" value={costs.depreciation} onChange={(v) => update("depreciation", v)} />
          <NumField label="기타 고정비" value={costs.otherFixed} onChange={(v) => update("otherFixed", v)} />
          <div className="rounded-xl bg-zinc-50 px-4 py-3 flex justify-between text-sm">
            <span className="text-zinc-500">고정비 합계 (4대보험 포함)</span>
            <span className="font-bold text-zinc-900">{formatKRW(totalFixed)}</span>
          </div>
        </section>

        {/* 변동비 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">변동비</p>
          <NumField label="소모품비" value={costs.supplies} onChange={(v) => update("supplies", v)} />
          <NumField label="마케팅 / 광고비" value={costs.marketing} onChange={(v) => update("marketing", v)} />
          <NumField label="주차비" value={costs.parkingFee ?? 0} onChange={(v) => update("parkingFee", v)} />
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
              💳 결제 수수료 <span className="text-blue-500 font-normal">(회원 등록 시 자동 반영)</span>
            </label>
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex justify-between text-sm">
              <span className="text-blue-600">카드 수수료 자동 합산</span>
              <span className="font-bold text-blue-700">{formatKRW(costs.paymentFee ?? 0)}</span>
            </div>
          </div>
          <NumField label="기타 변동비" value={costs.otherVariable} onChange={(v) => update("otherVariable", v)} />
          <div className="rounded-xl bg-zinc-50 px-4 py-3 flex justify-between text-sm">
            <span className="text-zinc-500">변동비 합계</span>
            <span className="font-bold text-zinc-900">{formatKRW(totalVariable)}</span>
          </div>
        </section>

        {/* 세금 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-zinc-900">부가세 과세 사업자</p>
              <p className="text-xs text-zinc-400 mt-0.5">실소진매출의 10%</p>
            </div>
            <button
              onClick={() => update("isVat", !costs.isVat)}
              className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative overflow-hidden ${costs.isVat ? "bg-blue-600" : "bg-zinc-200"}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${costs.isVat ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </section>

        <button
          onClick={handleSave}
          className="w-full rounded-xl bg-blue-600 py-4 font-semibold text-white hover:bg-blue-700 transition"
        >
          {saved ? "✓ 저장됨" : "저장하기"}
        </button>

        {/* ── 비용 구조 분석 차트 ── */}
        {(totalFixed + totalVariable) > 0 && (() => {
          const grandTotal = totalFixed + totalVariable;
          const salary     = costs.trainerSalary * (1 + 0.1065) + costs.freelanceSalary * 1.033;
          const space      = costs.rent + (costs.managementFee ?? 0);
          const utility    = costs.utilities + costs.communication;
          const depre      = costs.depreciation;
          const otherF     = costs.otherFixed;
          const supplies   = costs.supplies;
          const marketing  = costs.marketing;
          const parking    = costs.parkingFee ?? 0;
          const payFee     = costs.paymentFee ?? 0;
          const otherV     = costs.otherVariable;

          const items = [
            { label: "인건비",     amount: salary,  color: "bg-blue-500"   },
            { label: "임대료·관리비", amount: space, color: "bg-violet-500" },
            { label: "공과금·통신", amount: utility, color: "bg-cyan-500"   },
            { label: "감가상각",    amount: depre,   color: "bg-indigo-400" },
            { label: "기타 고정비", amount: otherF,  color: "bg-zinc-400"   },
            { label: "소모품비",    amount: supplies,color: "bg-emerald-500" },
            { label: "마케팅",      amount: marketing,color: "bg-orange-500"},
            { label: "주차비",      amount: parking, color: "bg-yellow-500"  },
            { label: "결제수수료",  amount: payFee,  color: "bg-pink-400"   },
            { label: "기타 변동비", amount: otherV,  color: "bg-zinc-300"   },
          ].filter((i) => i.amount > 0);

          return (
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <p className="font-bold text-zinc-900">📊 비용 구조 분석</p>
                <p className="text-sm font-black text-zinc-700">{formatKRW(grandTotal)}</p>
              </div>

              {/* 누적 바 차트 */}
              <div>
                <div className="flex h-5 rounded-full overflow-hidden gap-px">
                  {items.map((item) => (
                    <div
                      key={item.label}
                      className={`${item.color} transition-all`}
                      style={{ width: `${(item.amount / grandTotal) * 100}%` }}
                      title={`${item.label}: ${formatKRW(item.amount)}`}
                    />
                  ))}
                </div>
              </div>

              {/* 항목별 수평 바 + 수치 */}
              <div className="space-y-2.5">
                {items.map((item) => {
                  const pct = (item.amount / grandTotal) * 100;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                          <span className="text-zinc-600 font-medium">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400">{pct.toFixed(1)}%</span>
                          <span className="font-bold text-zinc-800 w-24 text-right">{formatKRW(item.amount)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 고정/변동 비율 */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-50">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-zinc-400">고정비 비율</p>
                  <p className="text-xl font-black text-blue-700 mt-0.5">
                    {((totalFixed / grandTotal) * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5">{formatKRW(totalFixed)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-zinc-400">변동비 비율</p>
                  <p className="text-xl font-black text-orange-600 mt-0.5">
                    {((totalVariable / grandTotal) * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-orange-500 mt-0.5">{formatKRW(totalVariable)}</p>
                </div>
              </div>

              {/* 인건비 경고 */}
              {salary / grandTotal > 0.45 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 font-semibold">
                  🔴 인건비 비율 {((salary / grandTotal) * 100).toFixed(1)}% — 권장 기준(40%) 초과
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
