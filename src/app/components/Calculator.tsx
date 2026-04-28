"use client";

import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { getPrefill, clearPrefill } from "../lib/store";

interface Step1 { totalPayment: string; totalSessions: string; conductedSessions: string; }
interface Step2 { rent: string; managementFee: string; trainerSalary: string; freelanceSalary: string; utilities: string; communication: string; equipmentCost: string; usefulLife: string; otherFixed: string; }
interface Step3 { isVat: boolean; supplies: string; marketing: string; parkingFee: string; paymentFee: string; otherVariable: string; }

interface Results {
  actualRevenue: number; unpaidLiability: number; vat: number;
  incomeTaxReserve: number; totalTax: number; insurance: number;
  freelanceTax: number; depreciation: number; totalFixed: number;
  totalVariable: number; netProfit: number; totalPayment: number;
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
    if (m) { total += parseFloat(m[1]) * unit; remaining = remaining.slice(m[0].length); }
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
  const insurance = trainerSalary * 0.1065;
  const freelanceSalary = parseKorean(s2.freelanceSalary);
  const freelanceTax = freelanceSalary * 0.033;
  const equipmentCost = parseKorean(s2.equipmentCost);
  const usefulLife = parseKorean(s2.usefulLife);
  const depreciation = usefulLife > 0 ? equipmentCost / (usefulLife * 12) : 0;
  const totalFixed = parseKorean(s2.rent) + parseKorean(s2.managementFee) + trainerSalary + insurance + freelanceSalary + freelanceTax + parseKorean(s2.utilities) + parseKorean(s2.communication) + depreciation + parseKorean(s2.otherFixed);
  const totalVariable = parseKorean(s3.supplies) + parseKorean(s3.marketing) + parseKorean(s3.parkingFee) + parseKorean(s3.paymentFee) + parseKorean(s3.otherVariable);
  const netProfit = actualRevenue - totalTax - totalFixed - totalVariable;
  return { actualRevenue, unpaidLiability, vat, incomeTaxReserve, totalTax, insurance, freelanceTax, depreciation, totalFixed, totalVariable, netProfit, totalPayment };
}

const inputClass = "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm";
const labelClass = "block text-xs font-semibold text-zinc-500 mb-1.5";

function NumInput({ label, value, onChange, hint, isCount }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; isCount?: boolean;
}) {
  const parsed = formatHint(value);
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        {!isCount && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>}
        <input type="text" inputMode={isCount ? "numeric" : "text"}
          placeholder={isCount ? "0" : "0 또는 만원"} value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass + (isCount ? " pr-10" : " pl-8")} />
        {isCount && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">회</span>}
      </div>
      {parsed && <p className="mt-1 text-xs font-medium text-blue-500">{parsed}</p>}
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

interface ImportedMonth { label: string; row: unknown[]; }

export default function Calculator() {
  const [s1, setS1] = useState<Step1>({ totalPayment: "", totalSessions: "", conductedSessions: "" });
  const [s2, setS2] = useState<Step2>({ rent: "", managementFee: "", trainerSalary: "", freelanceSalary: "", utilities: "", communication: "", equipmentCost: "", usefulLife: "", otherFixed: "" });
  const [s3, setS3] = useState<Step3>({ isVat: false, supplies: "", marketing: "", parkingFee: "", paymentFee: "", otherVariable: "" });
  const [result, setResult] = useState<Results | null>(null);
  const [importedMonths, setImportedMonths] = useState<ImportedMonth[]>([]);
  const [memberSessions, setMemberSessions] = useState({ total: 0, conducted: 0 });
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prefill = getPrefill();
    if (!prefill) return;
    clearPrefill();
    setS1({ totalPayment: String(prefill.totalPayment), totalSessions: String(prefill.totalSessions), conductedSessions: String(prefill.conductedSessions) });
    setS2({ rent: String(prefill.rent), managementFee: String(prefill.managementFee ?? 0), trainerSalary: String(prefill.trainerSalary), freelanceSalary: String(prefill.freelanceSalary), utilities: String(prefill.utilities ?? 0), communication: String(prefill.communication ?? 0), equipmentCost: prefill.depreciation > 0 ? String(prefill.depreciation * 12) : "", usefulLife: prefill.depreciation > 0 ? "1" : "", otherFixed: String(prefill.otherFixed) });
    setS3({ isVat: prefill.isVat, supplies: String(prefill.supplies), marketing: String(prefill.marketing), parkingFee: String(prefill.parkingFee ?? 0), paymentFee: String(prefill.paymentFee ?? 0), otherVariable: String(prefill.otherVariable) });
    setImportMsg("대시보드에서 데이터를 불러왔습니다.");
    setResult(null);
  }, []);

  const handleCalculate = () => setResult(calculate(s1, s2, s3));

  const reset = () => {
    setResult(null);
    setS1({ totalPayment: "", totalSessions: "", conductedSessions: "" });
    setS2({ rent: "", managementFee: "", trainerSalary: "", freelanceSalary: "", utilities: "", communication: "", equipmentCost: "", usefulLife: "", otherFixed: "" });
    setS3({ isVat: false, supplies: "", marketing: "", parkingFee: "", paymentFee: "", otherVariable: "" });
    setImportMsg(null);
  };

  const applyMonth = (row: unknown[], sessions: { total: number; conducted: number }, isVat: boolean) => {
    const n = (v: unknown) => (typeof v === "number" ? v : 0);
    setS1({ totalPayment: String(n(row[1])), totalSessions: String(sessions.total || 0), conductedSessions: String(sessions.conducted || 0) });
    const depreciation = n(row[12]);
    setS2({ rent: String(n(row[7])), managementFee: "", trainerSalary: String(n(row[8])), freelanceSalary: "", utilities: String(n(row[10])), communication: String(n(row[11])), equipmentCost: depreciation > 0 ? String(depreciation * 12) : "", usefulLife: depreciation > 0 ? "1" : "", otherFixed: String(n(row[13])) });
    setS3({ isVat, supplies: String(n(row[15])), marketing: String(n(row[16])), parkingFee: "", paymentFee: "", otherVariable: String(n(row[17]) + n(row[18]) + n(row[19]) + n(row[20])) });
    setShowMonthPicker(false);
    setResult(null);
  };

  const handleExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const profitWs = wb.Sheets["순이익정산"];
        if (!profitWs) { setImportMsg("'순이익정산' 시트를 찾을 수 없습니다."); return; }
        const profitData = XLSX.utils.sheet_to_json<unknown[]>(profitWs, { header: 1, defval: 0 });
        const vatSetting = (profitData[2] as unknown[])?.[6];
        const isVat = vatSetting === "과세";
        const dataRows = (profitData.slice(7) as unknown[][]).filter((row) => row[0] && typeof row[1] === "number" && row[1] > 0);
        if (dataRows.length === 0) { setImportMsg("정산 데이터가 없습니다."); return; }
        const memberWs = wb.Sheets["회원데이터"];
        let totalSessions = 0, conductedSessions = 0;
        if (memberWs) {
          const memberData = XLSX.utils.sheet_to_json<unknown[]>(memberWs, { header: 1, defval: 0 });
          memberData.slice(1).forEach((row) => {
            totalSessions += typeof row[6] === "number" ? row[6] : 0;
            conductedSessions += typeof row[7] === "number" ? row[7] : 0;
          });
        }
        const sessions = { total: totalSessions, conducted: conductedSessions };
        setMemberSessions(sessions);
        if (dataRows.length === 1) { applyMonth(dataRows[0], sessions, isVat); setImportMsg(`${dataRows[0][0]} 데이터를 불러왔습니다.`); }
        else { setImportedMonths(dataRows.map((row) => ({ label: String(row[0]), row }))); setShowMonthPicker(true); }
      } catch { setImportMsg("파일을 읽는 중 오류가 발생했습니다."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const monthlyDepreciation = parseKorean(s2.usefulLife) > 0
    ? parseKorean(s2.equipmentCost) / (parseKorean(s2.usefulLife) * 12) : 0;

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">

      {/* 월 선택 모달 */}
      {showMonthPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 mx-4">
            <p className="font-bold text-zinc-900 mb-1">월 선택</p>
            <p className="text-xs text-zinc-400 mb-4">불러올 월을 선택하세요</p>
            <div className="space-y-2">
              {importedMonths.map((m) => (
                <button key={m.label} onClick={() => { applyMonth(m.row, memberSessions, s3.isVat); setImportMsg(`${m.label} 데이터를 불러왔습니다.`); }}
                  className="w-full rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-blue-50 hover:border-blue-300 transition">
                  {m.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowMonthPicker(false)} className="mt-3 w-full rounded-xl py-2 text-xs text-zinc-400 hover:text-zinc-600">취소</button>
          </div>
        </div>
      )}


      {/* ── 1. 매출 정보 ── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">📊 매출 정보</p>
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <NumInput label="이번달 총 결제금액" value={s1.totalPayment} onChange={(v) => setS1({ ...s1, totalPayment: v })} hint="회원들이 이번달 결제한 총 금액" />
          <NumInput label="총 판매 회차" value={s1.totalSessions} onChange={(v) => setS1({ ...s1, totalSessions: v })} hint="판매한 PT 총 횟수" isCount />
          <NumInput label="이번달 실제 진행한 회차" value={s1.conductedSessions} onChange={(v) => setS1({ ...s1, conductedSessions: v })} hint="실제로 수업을 진행한 횟수" isCount />
        </div>
      </section>

      {/* ── 2. 고정비 ── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">🏢 고정비</p>
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <NumInput label="임차료 (월세)" value={s2.rent} onChange={(v) => setS2({ ...s2, rent: v })} />
          <NumInput label="관리비" value={s2.managementFee} onChange={(v) => setS2({ ...s2, managementFee: v })} />
          <NumInput label="정규직 인건비 합계" value={s2.trainerSalary} onChange={(v) => setS2({ ...s2, trainerSalary: v })} hint="4대보험+산재(10.65%)는 자동 계산됩니다" />
          <NumInput label="프리랜서 인건비 합계" value={s2.freelanceSalary} onChange={(v) => setS2({ ...s2, freelanceSalary: v })} hint="원천징수(3.3%)는 자동 계산됩니다" />

          {/* 감가상각 */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-zinc-500">감가상각비 계산기</p>
              <p className="text-xs text-zinc-400 mt-0.5">인테리어·장비 구입금액 + 내용연수 입력 시 자동 계산</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>구입금액</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
                  <input type="text" inputMode="text" placeholder="0 또는 만원" value={s2.equipmentCost}
                    onChange={(e) => setS2({ ...s2, equipmentCost: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 bg-white pl-7 pr-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition" />
                </div>
                {parseKorean(s2.equipmentCost) > 0 && (
                  <p className="mt-1 text-xs text-blue-500">→ {parseKorean(s2.equipmentCost).toLocaleString("ko-KR")}원</p>
                )}
              </div>
              <div>
                <label className={labelClass}>내용연수</label>
                <div className="relative">
                  <input type="number" placeholder="5" value={s2.usefulLife}
                    onChange={(e) => setS2({ ...s2, usefulLife: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 pr-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">년</span>
                </div>
              </div>
            </div>
            {monthlyDepreciation > 0 && (
              <div className="rounded-lg bg-blue-600 px-4 py-2.5 flex justify-between items-center">
                <span className="text-sm text-blue-100">월 감가상각비</span>
                <span className="font-bold text-white">{formatKRW(monthlyDepreciation)}</span>
              </div>
            )}
          </div>

          <NumInput label="공과금" value={s2.utilities} onChange={(v) => setS2({ ...s2, utilities: v })} />
          <NumInput label="통신비" value={s2.communication} onChange={(v) => setS2({ ...s2, communication: v })} />
          <NumInput label="기타 고정비" value={s2.otherFixed} onChange={(v) => setS2({ ...s2, otherFixed: v })} />
        </div>
      </section>

      {/* ── 3. 세금·변동비 ── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">💸 세금 · 변동비</p>
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-700">부가세 과세 사업자</p>
              <p className="text-xs text-zinc-400 mt-0.5">실소진매출의 10%</p>
            </div>
            <button onClick={() => setS3({ ...s3, isVat: !s3.isVat })}
              className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative overflow-hidden ${s3.isVat ? "bg-blue-600" : "bg-zinc-200"}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${s3.isVat ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-xs text-blue-700">
            종합소득세 적립금(3.3%)은 자동 계산됩니다
          </div>
          <NumInput label="소모품비" value={s3.supplies} onChange={(v) => setS3({ ...s3, supplies: v })} />
          <NumInput label="마케팅 / 광고비" value={s3.marketing} onChange={(v) => setS3({ ...s3, marketing: v })} />
          <NumInput label="주차비" value={s3.parkingFee} onChange={(v) => setS3({ ...s3, parkingFee: v })} />
          <NumInput label="결제 수수료" value={s3.paymentFee} onChange={(v) => setS3({ ...s3, paymentFee: v })} />
          <NumInput label="기타 변동비" value={s3.otherVariable} onChange={(v) => setS3({ ...s3, otherVariable: v })} />
        </div>
      </section>

      {/* ── 계산 버튼 ── */}
      <button onClick={handleCalculate} disabled={!s1.totalPayment || !s1.totalSessions || !s1.conductedSessions}
        className="w-full rounded-xl bg-blue-600 py-4 font-bold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition text-base">
        순이익 계산하기
      </button>

      {/* ── 결과 ── */}
      {result && (
        <div className="space-y-4">
          {/* 요약 카드 */}
          <div className="rounded-2xl bg-zinc-900 p-6 text-white">
            <p className="text-sm text-zinc-400 mb-1">이번달 총 결제금액</p>
            <p className="text-3xl font-bold text-white mb-4">{formatKRW(result.totalPayment)}</p>
            <div className="h-px bg-zinc-700 mb-4" />
            <p className="text-sm text-zinc-400 mb-1">실제 순이익</p>
            <p className={`text-4xl font-black ${result.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatKRW(result.netProfit)}
            </p>
            <p className="text-sm mt-3 text-zinc-400">
              미소진 부채 (잔여 수업 의무):{" "}
              <span className="text-yellow-400 font-bold">{formatKRW(result.unpaidLiability)}</span>
            </p>
          </div>

          {/* 상세 내역 */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
            <p className="font-bold text-zinc-900">상세 내역</p>
            <Row label="총 결제금액" value={result.totalPayment} neutral />
            <Row label="실소진매출 (진짜 매출)" value={result.actualRevenue} highlight />
            <Row label="미소진 부채 (아직 안 한 수업)" value={-result.unpaidLiability} red />
            <div className="h-px bg-zinc-100" />
            <Row label="세금 합계" value={-result.totalTax} red />
            <div className="pl-4 space-y-1">
              {result.vat > 0 && <SubRow label="부가세 (10%)" value={-result.vat} />}
              <SubRow label="종합소득세 적립 (3.3%)" value={-result.incomeTaxReserve} />
            </div>
            <div className="h-px bg-zinc-100" />
            <Row label="고정비 합계" value={-result.totalFixed} red />
            <div className="pl-4 space-y-1">
              <SubRow label="4대보험+산재 (10.65%)" value={-result.insurance} />
              {result.freelanceTax > 0 && <SubRow label="원천징수 (3.3%)" value={-result.freelanceTax} />}
              {result.depreciation > 0 && <SubRow label="감가상각비" value={-result.depreciation} />}
            </div>
            <div className="h-px bg-zinc-100" />
            <Row label="변동비 합계" value={-result.totalVariable} red />
            <div className="h-px bg-zinc-200" />
            <Row label="최종 순이익" value={result.netProfit} highlight large />
          </div>

          <button onClick={reset}
            className="w-full rounded-xl border border-zinc-200 py-3.5 font-semibold text-zinc-600 hover:bg-zinc-50 transition">
            다시 계산하기
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, neutral, highlight, red, large }: {
  label: string; value: number; neutral?: boolean; highlight?: boolean; red?: boolean; large?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center ${large ? "pt-1" : ""}`}>
      <span className={`text-sm ${highlight ? "font-semibold text-zinc-900" : "text-zinc-500"} ${large ? "text-base font-bold" : ""}`}>
        {label}
      </span>
      <span className={`font-semibold tabular-nums ${large ? "text-lg" : "text-sm"} ${
        neutral ? "text-zinc-900" : highlight ? (value >= 0 ? "text-emerald-600" : "text-red-500") : red ? "text-red-500" : "text-zinc-900"
      }`}>
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
