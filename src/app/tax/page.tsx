"use client";

import { useState, useEffect, useMemo } from "react";
import { getMembers, getSettlements, getTrainers, getCosts, currentMonth } from "../lib/store";

const INS_RATE = 0.1065; // 4대보험+산재 사업자 부담

function fmtW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function getQuarterMonths(quarter: number, year: number): string[] {
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 1, start + 2].map(
    (m) => `${year}-${String(m).padStart(2, "0")}`
  );
}

function getCurrentQuarter() {
  const now = new Date();
  return { q: Math.ceil((now.getMonth() + 1) / 3), year: now.getFullYear() };
}

function getYearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`
  );
}

type VatType = "과세" | "간이과세" | "면세";

const VAT_RATES: Record<VatType, number> = {
  "과세": 10,
  "간이과세": 4,
  "면세": 0,
};

export default function TaxPage() {
  const now = new Date();
  const { q: currentQ, year: currentYear } = getCurrentQuarter();

  const [vatType, setVatType] = useState<VatType>("과세");
  const [selectedQ, setSelectedQ] = useState(currentQ);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [members, setMembers]     = useState([] as ReturnType<typeof getMembers>);
  const [settlements, setSettlements] = useState([] as ReturnType<typeof getSettlements>);
  const [trainers, setTrainers]   = useState([] as ReturnType<typeof getTrainers>);
  const [allCosts, setAllCosts]   = useState([] as ReturnType<typeof getCosts>);

  useEffect(() => {
    setMembers(getMembers());
    setSettlements(getSettlements());
    setTrainers(getTrainers());
    setAllCosts(getCosts());
  }, []);

  const qMonths = useMemo(
    () => getQuarterMonths(selectedQ, selectedYear),
    [selectedQ, selectedYear]
  );
  const yearMonths = useMemo(() => getYearMonths(selectedYear), [selectedYear]);

  // ── 부가세 계산 ─────────────────────────────────────────────────────────────
  // 매출 = 회원 패키지 등록 금액 합산 (등록월 기준)
  const quarterRevenue = useMemo(() => {
    return members.flatMap((m) => m.packages ?? [])
      .filter((p) => qMonths.includes(p.registeredAt?.slice(0, 7) ?? ""))
      .reduce((s, p) => s + p.paymentAmount, 0);
  }, [members, qMonths]);

  const vatAmount = Math.round(quarterRevenue * VAT_RATES[vatType] / 100);

  // ── 원천징수 월별 합산 ───────────────────────────────────────────────────────
  const withholdingByMonth = useMemo(() => {
    return yearMonths.map((m) => {
      // 정산 완료된 프리랜서 원천징수
      const fromSettlements = settlements
        .filter((s) => s.month === m && s.settled && s.empType === "프리랜서")
        .reduce((sum, s) => sum + (s.withholdingTax ?? 0), 0);
      return { month: m, amount: fromSettlements };
    });
  }, [settlements, yearMonths]);

  const quarterWithholding = withholdingByMonth
    .filter((w) => qMonths.includes(w.month))
    .reduce((s, w) => s + w.amount, 0);

  const yearWithholding = withholdingByMonth.reduce((s, w) => s + w.amount, 0);

  // ── 4대보험 신고 기준 ────────────────────────────────────────────────────────
  const insuranceByMonth = useMemo(() => {
    return yearMonths.map((m) => {
      const fromSettlements = settlements
        .filter((s) => s.month === m && s.settled && s.empType === "정규직")
        .reduce((sum, s) => sum + (s.grossSalary ?? 0), 0);
      const employer = fromSettlements * INS_RATE;
      const employee = fromSettlements * 0.0908; // 근로자 부담 (국민연금4.5%+건강보험3.545%+고용보험0.9%≈8.95%)
      return { month: m, grossSalary: fromSettlements, employer, employee, total: employer + employee };
    });
  }, [settlements, yearMonths]);

  const quarterInsurance = insuranceByMonth
    .filter((ins) => qMonths.includes(ins.month))
    .reduce((s, ins) => s + ins.total, 0);

  // ── 이번 달 ──────────────────────────────────────────────────────────────────
  const thisMonth = currentMonth();
  const thisMonthW = withholdingByMonth.find((w) => w.month === thisMonth);
  const thisMonthIns = insuranceByMonth.find((ins) => ins.month === thisMonth);

  const quarterLabels: Record<number, string> = { 1: "1분기 (1~3월)", 2: "2분기 (4~6월)", 3: "3분기 (7~9월)", 4: "4분기 (10~12월)" };
  const vatDueDates: Record<number, string> = { 1: "4월 25일", 2: "7월 25일", 3: "10월 25일", 4: "다음해 1월 25일" };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-black text-zinc-900">세무 자동화 도우미</h1>
          <p className="text-sm text-zinc-500 mt-0.5">부가세 · 원천징수 · 4대보험 자동 계산</p>
        </div>

        {/* 사업자 유형 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <p className="font-bold text-zinc-900">사업자 유형</p>
          <div className="grid grid-cols-3 gap-2">
            {(["과세", "간이과세", "면세"] as VatType[]).map((t) => (
              <button key={t} onClick={() => setVatType(t)}
                className={`py-2.5 rounded-xl border text-sm font-semibold transition ${
                  vatType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-500 border-zinc-200"
                }`}>
                {t}
                <p className="text-xs font-normal mt-0.5 opacity-80">
                  {t === "과세" ? "10%" : t === "간이과세" ? "4%" : "0%"}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 분기 선택 */}
        <div className="flex items-center gap-3">
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none">
            {[currentYear - 1, currentYear].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <div className="flex gap-1 flex-1">
            {[1, 2, 3, 4].map((q) => (
              <button key={q} onClick={() => setSelectedQ(q)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition ${
                  selectedQ === q ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-500 border-zinc-200"
                }`}>
                {q}분기
              </button>
            ))}
          </div>
        </div>

        {/* 부가세 */}
        {vatType !== "면세" && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-zinc-900">💰 부가세 ({quarterLabels[selectedQ]})</p>
              <span className="text-xs text-zinc-400">신고 기한: {vatDueDates[selectedQ]}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>분기 총 매출 (등록 기준)</span>
                <span className="font-semibold">{fmtW(quarterRevenue)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>부가세율</span>
                <span className="font-semibold">{VAT_RATES[vatType]}%</span>
              </div>
              <div className="flex justify-between font-black text-base border-t border-zinc-100 pt-2">
                <span>납부 예정액</span>
                <span className="text-red-600">{fmtW(vatAmount)}</span>
              </div>
            </div>
            {vatAmount > 0 && (
              <div className="bg-red-50 rounded-xl p-3 text-xs text-red-700 font-semibold">
                📅 이번 {selectedQ}분기 부가세 납부 예정액: {fmtW(vatAmount)}
                <p className="font-normal mt-0.5 text-red-500">신고 기한: {selectedYear}년 {vatDueDates[selectedQ]}</p>
              </div>
            )}
            {quarterRevenue === 0 && (
              <p className="text-xs text-zinc-400 text-center py-2">이 분기에 등록된 패키지 매출이 없습니다</p>
            )}
          </div>
        )}

        {/* 원천징수 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">🧾 원천징수 (프리랜서 3.3%)</p>

          {/* 이번 달 */}
          <div className="bg-orange-50 rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-bold text-orange-700">이번 달 납부 예정 (다음달 10일까지)</p>
            <p className="text-2xl font-black text-orange-700">{fmtW(thisMonthW?.amount ?? 0)}</p>
            {(thisMonthW?.amount ?? 0) === 0 && (
              <p className="text-xs text-orange-400">정산 완료된 프리랜서 데이터가 없습니다</p>
            )}
          </div>

          {/* 분기 합산 */}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">{selectedQ}분기 합산</span>
            <span className="font-bold text-zinc-800">{fmtW(quarterWithholding)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">{selectedYear}년 연간 합산</span>
            <span className="font-bold text-zinc-800">{fmtW(yearWithholding)}</span>
          </div>

          {/* 월별 내역 */}
          <details className="group">
            <summary className="text-xs text-blue-500 font-semibold cursor-pointer">월별 내역 보기 ▼</summary>
            <div className="mt-3 space-y-1.5">
              {withholdingByMonth.map((w) => {
                const [, mo] = w.month.split("-");
                return (
                  <div key={w.month} className="flex justify-between text-xs">
                    <span className="text-zinc-500">{Number(mo)}월</span>
                    <span className={`font-semibold ${w.amount > 0 ? "text-zinc-800" : "text-zinc-300"}`}>
                      {w.amount > 0 ? fmtW(w.amount) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        </div>

        {/* 4대보험 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">🏥 4대보험 신고 기준 (정규직)</p>

          {/* 이번 달 */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-blue-700">이번 달 신고 기준 금액 (다음달 10일까지)</p>
            {(thisMonthIns?.grossSalary ?? 0) > 0 ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-blue-700">
                  <span>정규직 총 급여 합산</span>
                  <span className="font-semibold">{fmtW(thisMonthIns?.grossSalary ?? 0)}</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>사업주 부담 (10.65%)</span>
                  <span className="font-semibold">{fmtW(thisMonthIns?.employer ?? 0)}</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>근로자 부담 (~9.08%)</span>
                  <span className="font-semibold">{fmtW(thisMonthIns?.employee ?? 0)}</span>
                </div>
                <div className="flex justify-between font-black text-blue-800 border-t border-blue-100 pt-1.5">
                  <span>합계 납부액</span>
                  <span>{fmtW(thisMonthIns?.total ?? 0)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-blue-400">정산 완료된 정규직 데이터가 없습니다</p>
            )}
          </div>

          {/* 분기 합산 */}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">{selectedQ}분기 4대보험 합산</span>
            <span className="font-bold text-zinc-800">{fmtW(quarterInsurance)}</span>
          </div>

          {/* 요율 안내 */}
          <div className="rounded-xl bg-zinc-50 p-3 space-y-1 text-xs text-zinc-400">
            <p className="font-semibold text-zinc-500">📌 4대보험 요율 (사업주 부담)</p>
            <p>· 국민연금 4.5% · 건강보험 3.545% · 장기요양 0.46%</p>
            <p>· 고용보험 1.15% · 산재보험 ~1.0% → 합계 약 10.65%</p>
          </div>
        </div>

        {/* 종합 요약 */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-3">
          <p className="text-xs text-zinc-400">{selectedQ}분기 세금 총 부담 예상액</p>
          <div className="space-y-2 text-sm">
            {vatType !== "면세" && (
              <div className="flex justify-between">
                <span className="text-zinc-300">부가세</span>
                <span className="font-bold text-red-400">{fmtW(vatAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-300">원천징수 (프리랜서)</span>
              <span className="font-bold text-orange-400">{fmtW(quarterWithholding)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-300">4대보험 (사업주+근로자)</span>
              <span className="font-bold text-blue-400">{fmtW(quarterInsurance)}</span>
            </div>
            <div className="flex justify-between font-black text-base border-t border-zinc-700 pt-2">
              <span>합계</span>
              <span>{fmtW(vatAmount + quarterWithholding + quarterInsurance)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-100 p-4 text-xs text-zinc-400 space-y-1">
          <p className="font-semibold text-zinc-500">⚠️ 안내</p>
          <p>· 본 계산은 참고용이며 실제 세무 신고는 세무사 확인을 권장합니다</p>
          <p>· 원천징수·4대보험은 급여 정산 완료 데이터 기준으로 계산됩니다</p>
          <p>· 부가세 매출은 회원 패키지 등록 금액 기준입니다</p>
        </div>
      </div>
    </div>
  );
}
