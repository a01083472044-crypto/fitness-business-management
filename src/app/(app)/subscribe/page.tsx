"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadTossPayments } from "@tosspayments/payment-sdk";
import { supabase } from "../../lib/supabase";
import { getSession } from "../../lib/auth";
import Link from "next/link";

/* ── 플랜 정의 ── */
const PLANS = [
  {
    id: "starter",
    name: "스타터",
    price: 29000,
    priceLabel: "₩29,000",
    period: "/월",
    desc: "소규모 시설 운영에 최적화",
    features: ["회원 관리 (최대 200명)", "PT · 수강권 관리", "매출 기본 분석", "일정 관리", "이메일 지원"],
    color: "blue",
    popular: false,
  },
  {
    id: "pro",
    name: "프로",
    price: 59000,
    priceLabel: "₩59,000",
    period: "/월",
    desc: "성장하는 피트니스 비즈니스를 위해",
    features: ["회원 무제한", "모든 스타터 기능", "고급 매출 분석 · 대시보드", "다중 지점 관리", "SMS 발송 (100건/월)", "우선 고객 지원"],
    color: "indigo",
    popular: true,
  },
  {
    id: "enterprise",
    name: "엔터프라이즈",
    price: 0,
    priceLabel: "문의",
    period: "",
    desc: "대형 체인 · 프랜차이즈",
    features: ["프로 모든 기능", "지점 수 무제한", "전용 온보딩", "API 연동 지원", "전담 매니저", "맞춤 계약"],
    color: "violet",
    popular: false,
  },
] as const;

type PlanId = (typeof PLANS)[number]["id"];

export default function SubscribePage() {
  const router = useRouter();
  const [userId, setUserId]       = useState<string | null>(null);
  const [selected, setSelected]   = useState<PlanId>("pro");
  const [loading, setLoading]     = useState(false);
  const [checking, setChecking]   = useState(true);
  const [error, setError]         = useState("");

  /* ── 세션 확인 ── */
  useEffect(() => {
    getSession().then((s) => {
      if (!s) { router.replace("/login"); return; }
      setUserId(s.user.id);
      setChecking(false);
    });
  }, [router]);

  /* ── 결제 요청 (빌링키 발급) ── */
  const handleSubscribe = async () => {
    if (!userId) return;
    const plan = PLANS.find((p) => p.id === selected);
    if (!plan || plan.id === "enterprise") {
      window.open("mailto:support@fitboss.kr?subject=엔터프라이즈 문의", "_blank");
      return;
    }

    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      setError("결제 키가 설정되지 않았습니다. .env.local에 NEXT_PUBLIC_TOSS_CLIENT_KEY를 추가해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const tossPayments = await loadTossPayments(clientKey);
      const customerKey = `fitboss_${userId}`;

      // 빌링키 발급 요청 → Toss가 successUrl로 리다이렉트
      await tossPayments.requestBillingAuth("카드", {
        customerKey,
        successUrl: `${window.location.origin}/subscribe/success?plan=${plan.id}`,
        failUrl:    `${window.location.origin}/subscribe/fail`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "결제 요청에 실패했습니다.";
      // 사용자가 취소한 경우
      if (msg.includes("USER_CANCEL") || msg.includes("취소")) {
        setError("결제가 취소됐습니다.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  /* ── 현재 구독 현황 (DB 조회) ── */
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  useEffect(() => {
    if (!userId || !supabase) return;
    supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setCurrentPlan(`${data.plan} (${data.status})`);
      });
  }, [userId]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-blue-950 to-zinc-900 py-16 px-4">
      <div className="max-w-5xl mx-auto">

        {/* 헤더 */}
        <div className="text-center mb-12">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-6 transition">
            ← 대시보드로
          </Link>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
              <span className="text-2xl">💪</span>
            </div>
            <span className="text-3xl font-black text-white">FitBoss</span>
          </div>
          <h1 className="text-4xl font-black text-white">요금제 선택</h1>
          <p className="text-zinc-400 mt-2">14일 무료 체험 · 언제든지 해지 가능</p>
          {currentPlan && (
            <div className="inline-flex items-center gap-2 mt-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold px-4 py-1.5 rounded-full">
              ✓ 현재 구독 중: {currentPlan}
            </div>
          )}
        </div>

        {/* 플랜 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {PLANS.map((plan) => {
            const isSelected = selected === plan.id;
            const colorMap: Record<string, string> = {
              blue:   "border-blue-500 bg-blue-500/10",
              indigo: "border-indigo-400 bg-indigo-500/10",
              violet: "border-violet-500 bg-violet-500/10",
            };
            const btnMap: Record<string, string> = {
              blue:   "bg-blue-600 hover:bg-blue-500",
            indigo: "bg-indigo-600 hover:bg-indigo-500",
              violet: "bg-violet-600 hover:bg-violet-500",
            };

            return (
              <div
                key={plan.id}
                onClick={() => plan.id !== "enterprise" && setSelected(plan.id as PlanId)}
                className={`relative rounded-3xl border-2 p-6 cursor-pointer transition-all ${
                  isSelected
                    ? colorMap[plan.color]
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-black px-4 py-1 rounded-full">
                    인기 🔥
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-xl font-black text-white">{plan.name}</h3>
                  <p className="text-sm text-zinc-400 mt-1">{plan.desc}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-black text-white">{plan.priceLabel}</span>
                  <span className="text-zinc-400 text-sm ml-1">{plan.period}</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isSelected && plan.id !== "enterprise" && (
                  <div className="text-center text-xs font-bold text-blue-300">✓ 선택됨</div>
                )}
              </div>
            );
          })}
        </div>

        {/* 에러 */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300 font-medium mb-6 text-center">
            {error}
          </div>
        )}

        {/* 결제 버튼 */}
        <div className="flex justify-center">
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-lg px-12 py-4 rounded-2xl transition-all shadow-xl shadow-blue-900/50 flex items-center gap-3"
          >
            {loading ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />결제 진행 중...</>
            ) : selected === "enterprise" ? (
              "문의하기 →"
            ) : (
              `${PLANS.find(p => p.id === selected)?.name} 시작하기 — 14일 무료 체험 →`
            )}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-500 mt-6">
          카드 등록 후 14일 무료 · 이후 자동 결제 · 언제든지 해지 가능<br />
          결제는 <span className="text-zinc-400">토스페이먼츠</span>를 통해 안전하게 처리됩니다
        </p>
      </div>
    </div>
  );
}
