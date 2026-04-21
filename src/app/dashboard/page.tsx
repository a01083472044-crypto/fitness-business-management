"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMembers, getCosts, emptyCosts, currentMonth, setPrefill, MonthlyCosts } from "../lib/store";

function formatKRW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className="text-xl font-black text-zinc-900">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [costs, setCosts] = useState<MonthlyCosts>(emptyCosts(currentMonth()));
  const [memberStats, setMemberStats] = useState({ totalPayment: 0, totalSessions: 0, conductedSessions: 0, count: 0 });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const members = getMembers();
    setMemberStats({
      totalPayment: members.reduce((s, m) => s + m.totalPayment, 0),
      totalSessions: members.reduce((s, m) => s + m.totalSessions, 0),
      conductedSessions: members.reduce((s, m) => s + m.conductedSessions, 0),
      count: members.length,
    });

    const all = getCosts();
    const found = all.find((c) => c.month === month);
    setCosts(found ?? emptyCosts(month));
    setSent(false);
  }, [month]);

  const ratio = memberStats.totalSessions > 0 ? memberStats.conductedSessions / memberStats.totalSessions : 0;
  const actualRevenue = memberStats.totalPayment * ratio;
  const unpaidLiability = memberStats.totalPayment * (1 - ratio);
  const vat = costs.isVat ? actualRevenue * 0.1 : 0;
  const incomeTax = actualRevenue * 0.033;
  const insurance = costs.trainerSalary * 0.09;
  const totalFixed = costs.rent + costs.trainerSalary + insurance + costs.utilities + costs.communication + costs.depreciation + costs.otherFixed;
  const totalVariable = costs.supplies + costs.marketing + costs.otherVariable;
  const netProfit = actualRevenue - vat - incomeTax - totalFixed - totalVariable;

  const handleSendToCalc = () => {
    setPrefill({
      totalPayment: memberStats.totalPayment,
      totalSessions: memberStats.totalSessions,
      conductedSessions: memberStats.conductedSessions,
      rent: costs.rent,
      trainerSalary: costs.trainerSalary,
      depreciation: costs.depreciation,
      otherFixed: costs.utilities + costs.communication + costs.otherFixed,
      supplies: costs.supplies,
      marketing: costs.marketing,
      otherVariable: costs.otherVariable,
      isVat: costs.isVat,
    });
    setSent(true);
    setTimeout(() => router.push("/"), 600);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">대시보드</h1>
            <p className="text-sm text-zinc-500 mt-0.5">이번달 경영 현황</p>
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 회원 현황 */}
        <section className="space-y-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">회원 현황</p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="총 회원수" value={`${memberStats.count}명`} />
            <StatCard label="총 결제금액" value={formatKRW(memberStats.totalPayment)} />
            <StatCard label="실소진매출" value={formatKRW(actualRevenue)} sub={`소진률 ${Math.round(ratio * 100)}%`} />
            <StatCard label="미소진 부채" value={formatKRW(unpaidLiability)} sub={`${memberStats.totalSessions - memberStats.conductedSessions}회 잔여`} />
          </div>
        </section>

        {/* 비용 현황 */}
        <section className="space-y-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">비용 현황</p>
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-2.5">
            {[
              { label: "세금 합계", value: vat + incomeTax },
              { label: "고정비 합계 (4대보험 포함)", value: totalFixed },
              { label: "변동비 합계", value: totalVariable },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-zinc-500">{label}</span>
                <span className="font-semibold text-zinc-800">{formatKRW(value)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 순이익 요약 */}
        <section className="bg-zinc-900 rounded-2xl p-5 text-white space-y-2">
          <p className="text-sm text-zinc-400">예상 순이익</p>
          <p className={`text-4xl font-black ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatKRW(netProfit)}
          </p>
          <p className="text-xs text-zinc-500">
            실소진매출 기준 · 비용 관리 페이지에서 비용을 먼저 입력하세요
          </p>
        </section>

        {/* 계산기로 보내기 */}
        <button
          onClick={handleSendToCalc}
          disabled={sent}
          className="w-full rounded-xl bg-blue-600 py-4 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-400 transition text-base"
        >
          {sent ? "✓ 계산기로 이동 중..." : "📊 계산기로 보내서 상세 확인하기"}
        </button>

        {memberStats.count === 0 && (
          <p className="text-center text-xs text-zinc-400">
            회원 관리 페이지에서 회원을 먼저 등록하세요
          </p>
        )}
      </div>
    </div>
  );
}
