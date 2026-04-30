"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function StickyNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur border-b border-zinc-100 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-xl font-black text-blue-400">💪 FitBoss</span>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <a href="#features" className="hover:text-zinc-900 transition-colors">기능</a>
          <a href="#pricing" className="hover:text-zinc-900 transition-colors">요금제</a>
          <a href="#faq" className="hover:text-zinc-900 transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            로그인
          </Link>
          <Link
            href="/members"
            className="bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded-full hover:bg-blue-500 transition-colors"
          >
            무료로 시작하기 →
          </Link>
        </div>
      </div>
    </header>
  );
}
