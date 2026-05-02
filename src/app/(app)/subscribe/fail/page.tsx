"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SubscribeFailPage() {
  const params  = useSearchParams();
  const code    = params.get("code");
  const message = params.get("message");

  const friendlyMsg =
    code === "USER_CANCEL"
      ? "결제를 취소하셨습니다."
      : message
      ? decodeURIComponent(message)
      : "결제 처리 중 문제가 발생했습니다.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-blue-950 to-zinc-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">

        <div className="w-20 h-20 bg-red-500/80 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-red-900/50">
          <span className="text-4xl">😓</span>
        </div>

        <div>
          <h2 className="text-2xl font-black text-white">
            {code === "USER_CANCEL" ? "결제 취소" : "결제 실패"}
          </h2>
          <p className="text-zinc-400 text-sm mt-2">{friendlyMsg}</p>
          {code && code !== "USER_CANCEL" && (
            <p className="text-zinc-600 text-xs mt-1">오류 코드: {code}</p>
          )}
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

        <p className="text-zinc-600 text-xs">
          문제가 계속되면{" "}
          <a href="mailto:support@fitboss.kr" className="text-blue-400 hover:underline">
            support@fitboss.kr
          </a>
          로 문의해주세요.
        </p>
      </div>
    </div>
  );
}
