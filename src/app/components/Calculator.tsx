"use client";

import { useState } from "react";

interface Step1 {
  totalPayment: string;
  totalSessions: string;
  conductedSessions: string;
}

interface Step2 {
  rent: string;
  trainerSalary: string;
  equipmentCost: string;
  usefulLife: string;
  otherFixed: string;
}

interface Step3 {
  isVat: boolean;
  supplies: string;
  marketing: string;
  otherVariable: string;
}

interface Results {
  actualRevenue: number;
  unpaidLiability: number;
  vat: number;
  incomeTaxReserve: number;
  totalTax: number;
  insurance: number;
  depreciation: number;
  totalFixed: number;
  totalVariable: number;
  netProfit: number;
  totalPayment: number;
}

const formatKRW = (n: number) =>
  (n < 0 ? "-" : "") + "₩" + Math.abs(Math.round(n)).toLocaleString("ko-KR");

function parseKorean(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[원,\s]/g, "").trim();
  if (!cleaned) return 0;
  if (/^\d+$/.test(cleaned)) return Number(cleaned);

  let total = 0;
  let remaining = cleaned;

  const match = (pattern: RegExp, unit: number) => {
    const m = remaining.match(pattern);
    if (m) {
      total += parseFloat(m[1]) * unit;
      remaining = remaining.slice(m[0].length);
    }
  };

  match(/^(\d+(?:\.\d+)?)억/, 100000000);
  match(/^(\d+(?:\.\d+)?)천만/, 10000000);
  match(/^(\d+(?:\.\d+)?)만/, 10000);
  match(/^(\d+(?:\.\d+)?)천/, 1000);
  match(/^(\d+(?:\.\d+)?)백/, 100);
  if (/^\d+$/.test(remaining)) total += Number(remaining);

  return total || 0;
}

function formatHint(input: string): string | null {
  if (!input) return null;
  if (/^\d+$/.test(input.replace(/,/g, ""))) return null;
  const parsed = parseKorean(input);
  if (!parsed) return null;
  return "→ " + formatKRW(parsed);
}

function calculate(s1: Step1, s2: Step2, s3: Step3): Results {
  const totalPayment = parseKorean(s1.totalPayment);
  const totalSessions = parseKorean(s1.totalSessions) || 1;
  const conductedSessions = parseKorean(s1.conductedSessions);

  const ratio = conductedSessions / totalSessions;
  const actualRevenue = totalPayment * ratio;
  const unpaidLiability = totalPayment * (1 - ratio);

  const vat = s3.isVat ? actualRevenue * 0.1 : 0;
  const incomeTaxReserve = actualRevenue * 0.033;
  const totalTax = vat + incomeTaxReserve;

  const trainerSalary = parseKorean(s2.trainerSalary);
  const insurance = trainerSalary * 0.09;
  const equipmentCost = parseKorean(s2.equipmentCost);
  const usefulLife = parseKorean(s2.usefulLife);
  const depreciation = usefulLife > 0 ? equipmentCost / (usefulLife * 12) : 0;
  const totalFixed =
    parseKorean(s2.rent) +
    trainerSalary +
    insurance +
    depreciation +
    parseKorean(s2.otherFixed);

  const totalVariable =
    parseKorean(s3.supplies) +
    parseKorean(s3.marketing) +
    parseKorean(s3.otherVariable);

  const netProfit = actualRevenue - totalTax - totalFixed - totalVariable;

  return {
    actualRevenue,
    unpaidLiability,
    vat,
    incomeTaxReserve,
    totalTax,
    insurance,
    depreciation,
    totalFixed,
    totalVariable,
    netProfit,
    totalPayment,
  };
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition";

const labelClass = "block text-sm font-medium text-zinc-600 mb-1.5";

function NumberInput({
  label,
  placeholder,
  value,
  onChange,
  hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const isCount = placeholder.includes("회");
  const parsed = formatHint(value);
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        {!isCount && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
        )}
        <input
          type="text"
          inputMode={isCount ? "numeric" : "text"}
          placeholder={isCount ? "0" : "0 또는 300만"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass + (isCount ? " pl-4" : " pl-8")}
        />
        {isCount && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">회</span>
        )}
      </div>
      {parsed && (
        <p className="mt-1 text-xs font-medium text-blue-500">{parsed}</p>
      )}
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export default function Calculator() {
  const [step, setStep] = useState(1);
  const [s1, setS1] = useState<Step1>({
    totalPayment: "",
    totalSessions: "",
    conductedSessions: "",
  });
  const [s2, setS2] = useState<Step2>({
    rent: "",
    trainerSalary: "",
    equipmentCost: "",
    usefulLife: "",
    otherFixed: "",
  });
  const [s3, setS3] = useState<Step3>({
    isVat: false,
    supplies: "",
    marketing: "",
    otherVariable: "",
  });
  const [result, setResult] = useState<Results | null>(null);

  const handleCalculate = () => {
    setResult(calculate(s1, s2, s3));
    setStep(4);
  };

  const reset = () => {
    setStep(1);
    setResult(null);
    setS1({ totalPayment: "", totalSessions: "", conductedSessions: "" });
    setS2({ rent: "", trainerSalary: "", equipmentCost: "", usefulLife: "", otherFixed: "" });
    setS3({ isVat: false, supplies: "", marketing: "", otherVariable: "" });
  };

  const steps = ["매출 정보", "고정비", "세금·변동비", "결과"];

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Step indicator */}
      {step < 4 && (
        <div className="flex items-center justify-between mb-8">
          {steps.slice(0, 3).map((label, i) => {
            const num = i + 1;
            const active = step === num;
            const done = step > num;
            return (
              <div key={num} className="flex items-center gap-2">
                <button
                  onClick={() => setStep(num)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all cursor-pointer ${
                    done
                      ? "bg-blue-600 text-white"
                      : active
                      ? "bg-blue-600 text-white ring-4 ring-blue-100"
                      : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                  }`}
                >
                  {done ? "✓" : num}
                </button>
                <span
                  onClick={() => setStep(num)}
                  className={`text-sm font-medium cursor-pointer ${
                    active ? "text-blue-600" : done ? "text-zinc-600" : "text-zinc-300 hover:text-zinc-500"
                  }`}
                >
                  {label}
                </span>
                {i < 2 && (
                  <div
                    className={`h-px w-8 mx-1 ${
                      done ? "bg-blue-300" : "bg-zinc-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">이번달 매출 정보</h2>
            <p className="text-sm text-zinc-500 mt-1">
              회원들에게 받은 돈과 수업 현황을 입력하세요
            </p>
          </div>
          <NumberInput
            label="이번달 총 결제금액"
            placeholder="₩"
            value={s1.totalPayment}
            onChange={(v) => setS1({ ...s1, totalPayment: v })}
            hint="회원들이 이번달 결제한 총 금액"
          />
          <NumberInput
            label="총 판매 회차"
            placeholder="회"
            value={s1.totalSessions}
            onChange={(v) => setS1({ ...s1, totalSessions: v })}
            hint="판매한 PT 총 횟수"
          />
          <NumberInput
            label="이번달 실제 진행한 회차"
            placeholder="회"
            value={s1.conductedSessions}
            onChange={(v) => setS1({ ...s1, conductedSessions: v })}
            hint="실제로 수업을 진행한 횟수"
          />
          <button
            onClick={() => setStep(2)}
            disabled={!s1.totalPayment || !s1.totalSessions || !s1.conductedSessions}
            className="w-full rounded-xl bg-blue-600 py-3.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            다음 →
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">이번달 고정비</h2>
            <p className="text-sm text-zinc-500 mt-1">
              매달 고정으로 나가는 비용을 입력하세요
            </p>
          </div>
          <NumberInput
            label="임차료 (월세)"
            placeholder="₩"
            value={s2.rent}
            onChange={(v) => setS2({ ...s2, rent: v })}
          />
          <NumberInput
            label="트레이너 인건비 합계"
            placeholder="₩"
            value={s2.trainerSalary}
            onChange={(v) => setS2({ ...s2, trainerSalary: v })}
            hint="4대보험(9%)은 자동 계산됩니다"
          />
          {/* 감가상각 계산기 */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
            <div>
              <p className="font-medium text-zinc-900 text-sm">감가상각비 계산기</p>
              <p className="text-xs text-zinc-400 mt-0.5">인테리어 장비 구입금액과 내용연수를 입력하면 월 감가상각비를 자동 계산합니다</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>인테리어 장비 구입금액</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={s2.equipmentCost}
                    onChange={(e) => setS2({ ...s2, equipmentCost: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 bg-white pl-7 pr-3 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>내용연수</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="5"
                    value={s2.usefulLife}
                    onChange={(e) => setS2({ ...s2, usefulLife: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 pr-10 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">년</span>
                </div>
              </div>
            </div>
            {s2.equipmentCost && s2.usefulLife && parseKorean(s2.usefulLife) > 0 && (
              <div className="rounded-lg bg-blue-600 px-4 py-2.5 flex justify-between items-center">
                <span className="text-sm text-blue-100">월 감가상각비</span>
                <span className="font-bold text-white">
                  {formatKRW(parseKorean(s2.equipmentCost) / (parseKorean(s2.usefulLife) * 12))}
                </span>
              </div>
            )}
          </div>

          <NumberInput
            label="기타 고정비"
            placeholder="₩"
            value={s2.otherFixed}
            onChange={(v) => setS2({ ...s2, otherFixed: v })}
            hint="공과금, 통신비 등"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-zinc-200 py-3.5 font-semibold text-zinc-600 hover:bg-zinc-50 transition"
            >
              ← 이전
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!s2.rent && !s2.trainerSalary}
              className="flex-[2] rounded-xl bg-blue-600 py-3.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              다음 →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">세금 · 변동비</h2>
            <p className="text-sm text-zinc-500 mt-1">
              세금 설정과 변동 비용을 입력하세요
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900">부가세 과세 사업자</p>
                <p className="text-xs text-zinc-400 mt-0.5">실소진매출의 10%</p>
              </div>
              <button
                onClick={() => setS3({ ...s3, isVat: !s3.isVat })}
                className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative overflow-hidden ${
                  s3.isVat ? "bg-blue-600" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    s3.isVat ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
            종합소득세 적립금(3.3%)은 자동 계산됩니다
          </div>

          <NumberInput
            label="소모품비"
            placeholder="₩"
            value={s3.supplies}
            onChange={(v) => setS3({ ...s3, supplies: v })}
          />
          <NumberInput
            label="마케팅 / 광고비"
            placeholder="₩"
            value={s3.marketing}
            onChange={(v) => setS3({ ...s3, marketing: v })}
          />
          <NumberInput
            label="기타 변동비"
            placeholder="₩"
            value={s3.otherVariable}
            onChange={(v) => setS3({ ...s3, otherVariable: v })}
          />
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-xl border border-zinc-200 py-3.5 font-semibold text-zinc-600 hover:bg-zinc-50 transition"
            >
              ← 이전
            </button>
            <button
              onClick={handleCalculate}
              className="flex-[2] rounded-xl bg-blue-600 py-3.5 font-semibold text-white hover:bg-blue-700 transition"
            >
              순이익 계산하기
            </button>
          </div>
        </div>
      )}

      {/* Step 4 - Results */}
      {step === 4 && result && (
        <div className="space-y-4">
          {/* Shock card */}
          <div className="rounded-2xl bg-zinc-900 p-6 text-white">
            <p className="text-sm text-zinc-400 mb-1">내가 생각한 이번달 수익</p>
            <p className="text-3xl font-bold text-white mb-4">
              {formatKRW(result.totalPayment)}
            </p>
            <div className="h-px bg-zinc-700 mb-4" />
            <p className="text-sm text-zinc-400 mb-1">실제 순이익</p>
            <p
              className={`text-4xl font-black ${
                result.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatKRW(result.netProfit)}
            </p>
            <p className="text-sm mt-3 text-zinc-400">
              착각하고 있던 금액:{" "}
              <span className="text-yellow-400 font-bold">
                {formatKRW(Math.abs(result.totalPayment - result.netProfit))}
              </span>
            </p>
          </div>

          {/* Breakdown */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
            <p className="font-bold text-zinc-900 mb-2">상세 내역</p>

            <Row label="총 결제금액" value={result.totalPayment} neutral />
            <Row
              label={`실소진매출 (진짜 매출)`}
              value={result.actualRevenue}
              highlight
            />
            <Row
              label="미소진 부채 (아직 안 한 수업)"
              value={-result.unpaidLiability}
              red
            />

            <div className="h-px bg-zinc-100" />

            <Row label="세금 합계" value={-result.totalTax} red />
            <div className="pl-4 space-y-1">
              {result.vat > 0 && (
                <SubRow label="부가세 (10%)" value={-result.vat} />
              )}
              <SubRow label="종합소득세 적립 (3.3%)" value={-result.incomeTaxReserve} />
            </div>

            <div className="h-px bg-zinc-100" />

            <Row label="고정비 합계" value={-result.totalFixed} red />
            <div className="pl-4 space-y-1">
              <SubRow label="4대보험 (9%)" value={-result.insurance} />
              {result.depreciation > 0 && (
                <SubRow label="감가상각비" value={-result.depreciation} />
              )}
            </div>

            <div className="h-px bg-zinc-100" />

            <Row label="변동비 합계" value={-result.totalVariable} red />

            <div className="h-px bg-zinc-200" />

            <Row
              label="최종 순이익"
              value={result.netProfit}
              highlight
              large
            />
          </div>

          <button
            onClick={reset}
            className="w-full rounded-xl border border-zinc-200 py-3.5 font-semibold text-zinc-600 hover:bg-zinc-50 transition"
          >
            다시 계산하기
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  neutral,
  highlight,
  red,
  large,
}: {
  label: string;
  value: number;
  neutral?: boolean;
  highlight?: boolean;
  red?: boolean;
  large?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center ${large ? "pt-1" : ""}`}>
      <span
        className={`text-sm ${
          highlight ? "font-semibold text-zinc-900" : "text-zinc-500"
        } ${large ? "text-base font-bold" : ""}`}
      >
        {label}
      </span>
      <span
        className={`font-semibold tabular-nums ${large ? "text-lg" : "text-sm"} ${
          neutral
            ? "text-zinc-900"
            : highlight
            ? value >= 0
              ? "text-emerald-600"
              : "text-red-500"
            : red
            ? "text-red-500"
            : "text-zinc-900"
        }`}
      >
        {formatKRW(value)}
      </span>
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-xs text-zinc-400 tabular-nums">{formatKRW(value)}</span>
    </div>
  );
}
