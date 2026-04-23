"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { getSession } from "../lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
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

    if (!fullName.trim()) { setError("이름을 입력해주세요."); return; }
    if (password.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; }
    if (password !== confirm) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (!supabase) { setError("서비스 연결에 실패했습니다."); return; }

    setLoading(true);

    // Supabase Auth 계정 생성 (트리거가 자동으로 user_profiles 생성)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (signUpError || !data.user) {
      setError(signUpError?.message === "User already registered"
        ? "이미 가입된 이메일입니다."
        : (signUpError?.message ?? "가입에 실패했습니다."));
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-zinc-100 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-xl font-black text-zinc-900">가입 완료!</h2>
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 text-sm text-zinc-600 space-y-2 text-left">
            <p className="font-bold text-zinc-900">다음 단계</p>
            <p>1. 관리자에게 계정 승인을 요청하세요</p>
            <p>2. 관리자가 지점을 배정하면 사용 가능합니다</p>
            <p className="text-xs text-zinc-400 mt-2">가입 이메일: <strong>{email}</strong></p>
          </div>
          <Link href="/login"
            className="block w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 transition text-center">
            로그인 화면으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-zinc-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🏋️</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900">회원가입</h1>
          <p className="text-sm text-zinc-500 mt-1">가입 후 관리자 승인이 필요합니다</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 space-y-4">

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">이름 *</label>
            <input type="text" placeholder="홍길동" value={fullName} required
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">이메일 *</label>
            <input type="email" placeholder="example@gym.com" value={email} required
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">비밀번호 * (8자 이상)</label>
            <input type="password" placeholder="••••••••" value={password} required
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1.5">비밀번호 확인 *</label>
            <input type="password" placeholder="••••••••" value={confirm} required
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !email || !password || !fullName || !confirm}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />가입 중...</>
            ) : "회원가입"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 mt-5">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">로그인</Link>
        </p>
      </div>
    </div>
  );
}
