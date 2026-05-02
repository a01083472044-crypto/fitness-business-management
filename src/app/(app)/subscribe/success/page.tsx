"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Status = "loading" | "success" | "error";

export default function SubscribeSuccessPage() {
  const router      = useRouter();
  const params      = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [plan,   setPlan]   = useState("");
  const [error,  setError]  = useState("");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const authKey     = params.get("authKey");
    const customerKey = params.get("customerKey");
    const planId      = params.get("plan") ?? "pro";
    setPlan(planId);

    if (!authKey || !customerKey) {
      setError("결제 정보가 올바르지 않습니다.");
      setStatus("error");
      return;
    }

    // 서버 API로 빌링키 발급 요청
    fetch("/api/billing/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authKey, customerKey, plan: planId }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "결제 처리 실패");
        setStatus("success");
        // 3초 후 대시보드로
        setTimeout(() => router.replace("/dashboard"), 3000);
      })
      .catch((err: Error) => {
        setError(err.message);
        setStatus("error");
      });
  }, [params, router]);

  const PLAN_LABELS: Record<string, string> = {
    starter: "스타터",
    pro:     "프로",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-blue-950 to-zinc-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">

        {/* 로딩 */}
        {status === "loading" && (
          <>
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-900/50">
              <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">결제 처리 중</h2>
              <p className="text-zinc-400 text-sm mt-2">잠시만 기다려주세요...</p>
            </div>
          </>
        )}

        {/* 성공 */}
        {status === "success" && (
          <>
            <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-900/50">
              <span className="text-4xl">🎉</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">구독 완료!</h2>
              <p className="text-zinc-400 text-sm mt-2">
                <span className="text-white font-bold">{PLAN_LABELS[plan] ?? plan}</span> 플랜이 활성화됐습니다.<br />
                14일 무료 체험이 시작됩니다.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-sm text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">플랜</span>
                <span className="font-bold text-white">{PLAN_LABELS[plan] ?? plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">무료 체험</span>
                <span className="font-bold text-emerald-400">14일</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">첫 결제일</span>
                <span className="font-bold text-white">
                  {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </div>

            <p className="text-zinc-500 text-xs">3초 후 대시보드로 이동합니다...</p>

            <Link
              href="/dashboard"
              className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition"
            >
              대시보드로 이동 →
            </Link>
          </>
        )}

        {/* 실패 */}
        {status === "error" && (
          <>
            <div className="w-20 h-20 bg-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-red-900/50">
              <span className="text-4xl">⚠️</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">결제 오류</h2>
              <p className="text-zinc-400 text-sm mt-2">{error}</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/subscribe"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition text-center"
              >
                다시 시도
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 border border-white/20 text-zinc-300 hover:text-white font-semibold py-3 rounded-2xl transition text-center"
              >
                대시보드
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
