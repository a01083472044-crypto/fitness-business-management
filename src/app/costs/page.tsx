"use client";

import { useState, useEffect, ChangeEvent } from "react";
import React from "react";
import { getCosts, saveCosts, emptyCosts, currentMonth, MonthlyCosts } from "../lib/store";

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

  useEffect(() => {
    const all = getCosts();
    const found = all.find((c) => c.month === month);
    setCosts(found ?? emptyCosts(month));
    setSaved(false);
  }, [month]);

  const update = <K extends keyof MonthlyCosts>(key: K, val: MonthlyCosts[K]) => {
    setCosts((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = () => {
    const all = getCosts();
    const idx = all.findIndex((c) => c.month === month);
    if (idx >= 0) all[idx] = costs;
    else all.push(costs);
    saveCosts(all);
    setSaved(true);
  };

  const totalFixed =
    costs.rent +
    costs.trainerSalary + costs.trainerSalary * 0.09 +
    costs.freelanceSalary + costs.freelanceSalary * 0.033 +
    costs.utilities + costs.communication + costs.depreciation + costs.otherFixed;
  const totalVariable = costs.supplies + costs.marketing + costs.otherVariable;

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

        {/* 고정비 */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">고정비</p>
          <NumField label="임차료 (월세)" value={costs.rent} onChange={(v) => update("rent", v)} />
          <NumField label="정규직 인건비 합계" value={costs.trainerSalary} onChange={(v) => update("trainerSalary", v)} hint="4대보험(9%)은 자동 계산됩니다" />
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
      </div>
    </div>
  );
}
