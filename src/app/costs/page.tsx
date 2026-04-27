"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import React from "react";
import {
  getCosts, saveCosts, emptyCosts, currentMonth,
  MonthlyCosts, getBranches, getTrainers,
} from "../lib/store";

// ── 유틸 ──────────────────────────────────────────────────────────────────
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

// ── NumField: 클릭-선택 / × 지우기 / 외부 값 동기화 ─────────────────────
function NumField({
  label, value, onChange, hint, badge,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  badge?: { text: string; color: string };
}) {
  const [raw,     setRaw]     = useState(value > 0 ? String(value) : "");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 월 변경 등 외부에서 value가 바뀔 때 동기화 (입력 중에는 덮어쓰지 않음)
  useEffect(() => {
    if (!focused) {
      setRaw(value > 0 ? String(value) : "");
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value);
    onChange(parseKorean(e.target.value));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault(); // blur 방지
    setRaw("");
    onChange(0);
    inputRef.current?.focus();
  };

  const parsed = parseKorean(raw);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-zinc-500">{label}</label>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm pointer-events-none">₩</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          placeholder="0  또는  150만"
          value={raw}
          onChange={handleChange}
          onFocus={(e) => { setFocused(true); e.target.select(); }}   // 포커스 시 전체 선택
          onBlur={() => setFocused(false)}
          className={`${inputCls} pl-8 ${raw ? "pr-10" : ""}`}
        />
        {/* × 지우기 버튼 */}
        {raw && (
          <button
            type="button"
            onMouseDown={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-100 hover:bg-red-100 text-zinc-400 hover:text-red-500 flex items-center justify-center text-xs font-black transition"
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>
      {parsed > 0 && (
        <p className="mt-1 text-xs font-medium text-blue-500">
          → {parsed.toLocaleString("ko-KR")}원
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

// ── 결제 수수료 필드 (자동 연동 ↔ 직접 입력 전환) ─────────────────────────
function PaymentFeeField({
  autoValue, value, onChange,
}: {
  autoValue: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const [manual, setManual] = useState(false);

  // autoValue가 바뀌면 수동 모드 아닐 때 자동 반영
  useEffect(() => {
    if (!manual) onChange(autoValue);
  }, [autoValue, manual]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-zinc-500">
          💳 결제 수수료
        </label>
        <button
          type="button"
          onClick={() => {
            if (manual) { setManual(false); onChange(autoValue); }
            else        { setManual(true); }
          }}
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full transition ${
            manual
              ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
        >
          {manual ? "🔗 연동값 복원" : "✏️ 직접 입력"}
        </button>
      </div>

      {manual ? (
        <NumField
          label=""
          value={value}
          onChange={onChange}
          hint="카드·간편결제 수수료를 직접 입력합니다"
        />
      ) : (
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex justify-between items-center text-sm">
          <span className="text-blue-600 text-xs">회원 등록 카드 수수료 자동 합산</span>
          <span className="font-bold text-blue-700">{formatKRW(autoValue)}</span>
        </div>
      )}
    </div>
  );
}

// ── 직선법 감가상각 계산기 ────────────────────────────────────────────────
interface DepreAsset {
  id: string;
  name: string;
  cost: number;      // 취득원가
  salvage: number;   // 잔존가치
  lifeYears: number; // 내용연수 (년)
}

const LIFE_PRESETS = [
  { label: "3년 (전자기기)", value: 3 },
  { label: "5년 (운동기구)", value: 5 },
  { label: "8년 (냉난방기)", value: 8 },
  { label: "10년 (인테리어)", value: 10 },
  { label: "20년 (구조물)", value: 20 },
];

function newAsset(): DepreAsset {
  return { id: crypto.randomUUID(), name: "", cost: 0, salvage: 0, lifeYears: 5 };
}

function monthlyDepr(a: DepreAsset): number {
  if (!a.cost || !a.lifeYears) return 0;
  return Math.round((a.cost - a.salvage) / a.lifeYears / 12);
}

function DeprCalcField({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [assets, setAssets] = useState<DepreAsset[]>([newAsset()]);

  const totalMonthly = useMemo(
    () => assets.reduce((s, a) => s + monthlyDepr(a), 0),
    [assets]
  );

  function updateAsset(id: string, patch: Partial<DepreAsset>) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function removeAsset(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }
  function applyTotal() {
    onChange(totalMonthly);
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      {/* 감가상각비 직접 입력 필드 */}
      <NumField
        label="감가상각비 (월)"
        value={value}
        onChange={onChange}
        hint="아래 직선법 계산기로 자동 산출할 수 있습니다"
      />

      {/* 계산기 토글 버튼 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl py-2 transition"
      >
        🧮 직선법 감가상각 계산기 {open ? "▲" : "▼"}
      </button>

      {/* 계산기 패널 */}
      {open && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-black text-indigo-700">
            📐 직선법: 월 감가상각비 = (취득원가 − 잔존가치) ÷ 내용연수(년) ÷ 12
          </p>

          {/* 자산 목록 */}
          <div className="space-y-3">
            {assets.map((a, idx) => {
              const monthly = monthlyDepr(a);
              return (
                <div key={a.id} className="bg-white rounded-xl p-3 space-y-2 border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-500">자산 {idx + 1}</span>
                    {assets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAsset(a.id)}
                        className="text-xs text-red-400 hover:text-red-600 font-bold"
                      >
                        × 삭제
                      </button>
                    )}
                  </div>

                  {/* 자산명 */}
                  <input
                    type="text"
                    placeholder="자산명 (예: 인테리어, 운동기구)"
                    value={a.name}
                    onChange={(e) => updateAsset(a.id, { name: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                  />

                  {/* 취득원가 */}
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 mb-0.5 block">취득원가</label>
                    <input
                      type="text"
                      placeholder="예: 1500만"
                      defaultValue={a.cost > 0 ? String(a.cost) : ""}
                      onBlur={(e) => updateAsset(a.id, { cost: parseKorean(e.target.value) })}
                      key={`cost-${a.id}`}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  {/* 잔존가치 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-zinc-400">잔존가치</label>
                      <span className="text-[10px] text-indigo-500 font-semibold">
                        💡 통상 취득원가의 5~10%
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="0원 (없음)"
                      defaultValue={a.salvage > 0 ? String(a.salvage) : ""}
                      onBlur={(e) => updateAsset(a.id, { salvage: parseKorean(e.target.value) })}
                      key={`salvage-${a.id}`}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                    />
                    {/* 빠른 설정 버튼 */}
                    <div className="flex gap-1.5">
                      {[
                        { label: "없음 (0%)", rate: 0 },
                        { label: `5% ${a.cost > 0 ? "= " + Math.round(a.cost * 0.05).toLocaleString() + "원" : ""}`, rate: 0.05 },
                        { label: `10% ${a.cost > 0 ? "= " + Math.round(a.cost * 0.10).toLocaleString() + "원" : ""}`, rate: 0.10 },
                      ].map(({ label, rate }) => {
                        const sv = Math.round(a.cost * rate);
                        const active = a.salvage === sv && (rate === 0 ? a.salvage === 0 : true);
                        return (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => updateAsset(a.id, { salvage: sv })}
                            className={`flex-1 text-[10px] font-bold px-1.5 py-1 rounded-lg border transition text-center leading-tight ${
                              active
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-zinc-500 border-zinc-200 hover:border-indigo-300 hover:text-indigo-600"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-snug">
                      세법상 잔존가치는 0원이 일반적이나, 실제 처분가치를 고려해 5~10%로 설정하기도 합니다.
                    </p>
                  </div>

                  {/* 내용연수 */}
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 mb-1 block">내용연수</label>
                    <div className="flex gap-1 flex-wrap">
                      {LIFE_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => updateAsset(a.id, { lifeYears: p.value })}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                            a.lifeYears === p.value
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-zinc-500 border-zinc-200 hover:border-indigo-300"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 결과 */}
                  {monthly > 0 && (
                    <div className="bg-indigo-50 rounded-lg px-3 py-2 flex justify-between items-center">
                      <span className="text-xs text-indigo-600">월 감가상각비</span>
                      <span className="font-black text-indigo-700 text-sm">{formatKRW(monthly)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 자산 추가 버튼 */}
          <button
            type="button"
            onClick={() => setAssets((prev) => [...prev, newAsset()])}
            className="w-full text-xs font-bold text-indigo-500 bg-white border border-indigo-200 rounded-xl py-2 hover:bg-indigo-50 transition"
          >
            + 자산 추가
          </button>

          {/* 합계 + 적용 */}
          <div className="bg-indigo-600 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-indigo-200 text-xs font-semibold">전체 월 감가상각비 합계</p>
              <p className="text-white font-black text-xl">{formatKRW(totalMonthly)}</p>
            </div>
            <button
              type="button"
              onClick={applyTotal}
              disabled={totalMonthly === 0}
              className="bg-white text-indigo-700 font-black text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition disabled:opacity-40"
            >
              📌 적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────
export default function CostsPage() {
  const [month,          setMonth]          = useState(currentMonth());
  const [costs,          setCosts]          = useState<MonthlyCosts>(emptyCosts(currentMonth()));
  const [autoPaymentFee, setAutoPaymentFee] = useState(0); // 연동된 원래 수수료
  const [saved,          setSaved]          = useState(false);
  const [branches,       setBranches]       = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [showReset,      setShowReset]      = useState(false);

  useEffect(() => {
    const saved = getBranches();
    const trainerBranches = getTrainers().map((t) => t.branch).filter(Boolean);
    setBranches(Array.from(new Set([...saved, ...trainerBranches])));
  }, []);

  useEffect(() => {
    const all   = getCosts();
    const found = all.find((c) => c.month === month && (c.branch ?? "") === selectedBranch);
    const data  = found ?? emptyCosts(month, selectedBranch);
    setCosts(data);
    setAutoPaymentFee(data.paymentFee ?? 0); // 연동 원본 보존
    setSaved(false);
  }, [month, selectedBranch]);

  const update = useCallback(<K extends keyof MonthlyCosts>(key: K, val: MonthlyCosts[K]) => {
    setCosts((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    const all = getCosts();
    const idx = all.findIndex((c) => c.month === month && (c.branch ?? "") === selectedBranch);
    if (idx >= 0) all[idx] = costs;
    else all.push(costs);
    saveCosts(all);
    setSaved(true);
  };

  // 전체 초기화 (분석용 직접 입력 모드)
  const handleReset = () => {
    setCosts(emptyCosts(month, selectedBranch));
    setAutoPaymentFee(0);
    setSaved(false);
    setShowReset(false);
  };

  // ── 집계 ───────────────────────────────────────────────────────────────
  const salary    = costs.trainerSalary * (1 + 0.1065) + costs.freelanceSalary * 1.033;
  const space     = costs.rent + (costs.managementFee ?? 0);
  const utility   = costs.utilities + costs.communication;
  const depre     = costs.depreciation;
  const otherF    = costs.otherFixed;
  const supplies  = costs.supplies;
  const marketing = costs.marketing;
  const parking   = costs.parkingFee ?? 0;
  const payFee    = costs.paymentFee ?? 0;
  const otherV    = costs.otherVariable;

  const totalFixed    = space + salary + utility + depre + otherF;
  const totalVariable = supplies + marketing + parking + payFee + otherV;
  const grandTotal    = totalFixed + totalVariable;

  const items = [
    { label: "인건비",      amount: salary,    color: "bg-blue-500"    },
    { label: "임대료·관리비", amount: space,   color: "bg-violet-500"  },
    { label: "공과금·통신",  amount: utility,  color: "bg-cyan-500"    },
    { label: "감가상각",     amount: depre,    color: "bg-indigo-400"  },
    { label: "기타 고정비",  amount: otherF,   color: "bg-zinc-400"    },
    { label: "소모품비",     amount: supplies, color: "bg-emerald-500" },
    { label: "마케팅",       amount: marketing,color: "bg-orange-500"  },
    { label: "주차비",       amount: parking,  color: "bg-yellow-500"  },
    { label: "결제수수료",   amount: payFee,   color: "bg-pink-400"    },
    { label: "기타 변동비",  amount: otherV,   color: "bg-zinc-300"    },
  ].filter((i) => i.amount > 0);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">비용 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">월별 고정비 · 변동비 입력 · 직접 계산</p>
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 사용 안내 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-0.5">
          <p className="font-bold">💡 입력 방법</p>
          <p>· 숫자 클릭 → 전체 선택 → 바로 덮어쓰기</p>
          <p>· 각 항목 우측 <span className="font-bold bg-zinc-100 text-zinc-500 px-1 rounded">×</span> 버튼으로 개별 삭제</p>
          <p>· 입력 즉시 하단 비용 구조 분석에 반영됩니다</p>
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

        {/* ── 고정비 ─────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">📌 고정비</p>
          <NumField label="임차료 (월세)"    value={costs.rent}              onChange={(v) => update("rent", v)} />
          <NumField label="관리비"           value={costs.managementFee ?? 0} onChange={(v) => update("managementFee", v)} />
          <NumField label="정규직 인건비 합계" value={costs.trainerSalary}   onChange={(v) => update("trainerSalary", v)}
            hint="4대보험(10.65%)은 자동 계산됩니다"
            badge={{ text: "4대보험 자동", color: "bg-blue-50 text-blue-600" }}
          />
          <NumField label="프리랜서 인건비 합계" value={costs.freelanceSalary} onChange={(v) => update("freelanceSalary", v)}
            hint="원천징수(3.3%)는 자동 계산됩니다"
            badge={{ text: "원천징수 자동", color: "bg-orange-50 text-orange-600" }}
          />
          <NumField label="공과금"          value={costs.utilities}          onChange={(v) => update("utilities", v)} />
          <NumField label="통신비"          value={costs.communication}      onChange={(v) => update("communication", v)} />
          <DeprCalcField value={costs.depreciation} onChange={(v) => update("depreciation", v)} />
          <NumField label="기타 고정비"     value={costs.otherFixed}         onChange={(v) => update("otherFixed", v)} />
          <div className="rounded-xl bg-zinc-50 px-4 py-3 flex justify-between text-sm border border-zinc-100">
            <span className="text-zinc-500 font-medium">고정비 합계 (4대보험 포함)</span>
            <span className="font-black text-zinc-900">{formatKRW(totalFixed)}</span>
          </div>
        </section>

        {/* ── 변동비 ─────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">📈 변동비</p>
          <NumField label="소모품비"     value={costs.supplies}           onChange={(v) => update("supplies", v)} />
          <NumField label="마케팅 · 광고비" value={costs.marketing}       onChange={(v) => update("marketing", v)} />
          <NumField label="주차비"       value={costs.parkingFee ?? 0}   onChange={(v) => update("parkingFee", v)} />

          {/* 결제 수수료 — 자동 연동 ↔ 직접 입력 */}
          <PaymentFeeField
            autoValue={autoPaymentFee}
            value={costs.paymentFee ?? 0}
            onChange={(v) => update("paymentFee", v)}
          />

          <NumField label="기타 변동비" value={costs.otherVariable}     onChange={(v) => update("otherVariable", v)} />
          <div className="rounded-xl bg-zinc-50 px-4 py-3 flex justify-between text-sm border border-zinc-100">
            <span className="text-zinc-500 font-medium">변동비 합계</span>
            <span className="font-black text-zinc-900">{formatKRW(totalVariable)}</span>
          </div>
        </section>

        {/* ── 부가세 사업자 ──────────────────────────────────────────────── */}
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

        {/* ── 버튼 영역 ──────────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 rounded-xl bg-blue-600 py-4 font-semibold text-white hover:bg-blue-700 transition"
          >
            {saved ? "✓ 저장됨" : "저장하기"}
          </button>
          <button
            onClick={() => setShowReset(true)}
            className="px-5 rounded-xl bg-zinc-100 text-zinc-500 font-semibold hover:bg-zinc-200 transition text-sm"
          >
            초기화
          </button>
        </div>

        {/* 초기화 확인 */}
        {showReset && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-red-700">⚠️ 전체 초기화</p>
            <p className="text-xs text-red-600">모든 입력값이 0으로 초기화됩니다. (저장된 데이터는 변경되지 않습니다)</p>
            <div className="flex gap-2">
              <button onClick={handleReset}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition">
                초기화
              </button>
              <button onClick={() => setShowReset(false)}
                className="flex-1 py-2.5 bg-zinc-100 text-zinc-600 text-sm font-bold rounded-xl hover:bg-zinc-200 transition">
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── 비용 구조 분석 차트 ────────────────────────────────────────── */}
        {grandTotal > 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <p className="font-bold text-zinc-900">📊 비용 구조 분석</p>
              <p className="text-sm font-black text-zinc-700">{formatKRW(grandTotal)}</p>
            </div>

            {/* 스택 바 */}
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

            {/* 항목별 수평 바 */}
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
                      <div className={`h-1.5 rounded-full ${item.color} transition-all`} style={{ width: `${pct}%` }} />
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

            {/* 항목 요약 텍스트 */}
            <div className="bg-zinc-50 rounded-xl p-3 text-xs text-zinc-500 space-y-1">
              <p className="font-semibold text-zinc-600">📌 분석 요약</p>
              <p>· 월 총 비용: {formatKRW(grandTotal)}</p>
              <p>· 인건비 비중: {salary > 0 ? ((salary / grandTotal) * 100).toFixed(1) : 0}%
                {salary / grandTotal > 0.45 ? " ⚠️ 높음" : salary / grandTotal > 0.35 ? " 적정" : " 낮음"}</p>
              <p>· 공간비 비중: {space > 0 ? ((space / grandTotal) * 100).toFixed(1) : 0}%</p>
              {!saved && <p className="text-blue-500 font-semibold">* 저장하지 않으면 다른 페이지에 반영되지 않습니다</p>}
            </div>
          </div>
        ) : (
          /* 값이 없을 때 — 안내 카드 */
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center space-y-2">
            <p className="text-3xl">📊</p>
            <p className="font-bold text-zinc-700">비용 구조 분석</p>
            <p className="text-sm text-zinc-400">위 항목을 입력하면 실시간으로 분석이 표시됩니다</p>
            <p className="text-xs text-zinc-300">저장 없이 직접 입력해도 분석 가능합니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
