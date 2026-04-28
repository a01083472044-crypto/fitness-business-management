"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, getSession } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);

  // 이미 로그인된 경우 홈으로
  useEffect(() => {
    getSession().then((s) => {
      if (s) router.replace("/");
      else setChecking(false);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }
    router.replace("/");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-zinc-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* 로고 영역 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🏋️</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900">FitBoss</h1>
          <p className="text-sm text-zinc-500 mt-1">지점 계정으로 로그인하세요</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 space-y-4">

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">이메일</label>
            <input
              type="email"
              placeholder="example@gym.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">비밀번호</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                로그인 중...
              </>
            ) : "로그인"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 mt-5">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-blue-600 font-semibold hover:underline">회원가입</Link>
        </p>
      </div>
    </div>
  );
}
