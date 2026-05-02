"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSession } from "../lib/auth";

export default function HeroCTA() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    getSession().then((s) => setLoggedIn(!!s));
  }, []);

  // 세션 확인 전 — 버튼 자리만 유지
  if (loggedIn === null) {
    return <div className="mt-10 h-16" />;
  }

  if (loggedIn) {
    return (
      <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/dashboard"
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/50"
        >
          대시보드로 이동 →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
      <Link
        href="/signup"
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/50"
      >
        무료로 시작하기 → 지금 바로
      </Link>
      <a
        href="#features"
        className="border border-zinc-600 hover:border-zinc-400 text-zinc-300 hover:text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-all"
      >
        기능 둘러보기
      </a>
    </div>
  );
}
