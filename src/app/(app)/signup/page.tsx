"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { getSession } from "../../lib/auth";
import { BUSINESS_TYPE_LIST, BUSINESS_CONFIGS, BusinessType } from "../../lib/store";

type Step = "info" | "biztype";

export default function SignupPage() {
  const router = useRouter();
  const [step,     setStep]    = useState<Step>("info");
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]   = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm] = useState("");
  const [bizType,  setBizType] = useState<BusinessType | "">("");
  const [error,    setError]   = useState("");
  const [loading,  setLoading] = useState(false);
  const [done,     setDone]    = useState(false);
  const [checking, setChecking] = useState(true);

  // 이미 로그인된 경우 대시보드로
  useEffect(() => {
    getSession().then((s) => {
      if (s) router.replace("/dashboard");
      else setChecking(false);
    });
  }, [router]);

  /* ── STEP 1: 유효성 검사 후 다음 단계 ── */
  const handleInfoNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim())     { setError("이름을 입력해주세요."); return; }
    if (password.length < 8)  { setError("비밀번호는 8자 이상이어야 합니다."); return; }
    if (password !== confirm)  { setError("비밀번호가 일치하지 않습니다."); return; }
    setStep("biztype");
  };

  /* ── STEP 2: 가입 처리 ── */
  const handleSubmit = async () => {
    if (!bizType)  { setError("사업자 유형을 선택해주세요."); return; }
    if (!supabase) { setError("서비스 연결에 실패했습니다."); return; }
    setError("");
    setLoading(true);

    // 1) Supabase Auth 계정 생성
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (signUpError || !data.user) {
      setError(
        signUpError?.message === "User already registered"
          ? "이미 가입된 이메일입니다."
          : (signUpError?.message ?? "가입에 실패했습니다.")
      );
      setLoading(false);
      return;
    }

    // 2) user_profiles 업데이트 (트리거 생성 대기 후 upsert)
    await new Promise((r) => setTimeout(r, 1500));
    await supabase.from("user_profiles").upsert(
      {
        id:            data.user.id,
        email,
        full_name:     fullName.trim(),
        business_type: bizType,
        role:          "pending",   // 총관리자 승인 후 사용 가능
      },
      { onConflict: "id" }
    );

    setDone(true);
    setLoading(false);
  };

  /* ── 세션 확인 중 ── */
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── 가입 완료 화면 ── */
  if (done) {
    const cfg = bizType ? BUSINESS_CONFIGS[bizType as BusinessType] : null;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-zinc-100 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-5">

          {/* 완료 아이콘 */}
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-200">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-2xl font-black text-zinc-900 mt-4">가입 완료!</h2>
            <p className="text-sm text-zinc-500 mt-1">핏보스를 시작할 준비가 됐습니다</p>
          </div>

          {/* 선택한 사업자 유형 */}
          {cfg && (
            <div className="flex items-center justify-center gap-3 bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
              <span className="text-3xl">{cfg.icon}</span>
              <div>
                <p className="text-xs text-zinc-400 font-medium">선택한 사업 유형</p>
                <p className="font-black text-zinc-900">{cfg.label}</p>
              </div>
              <div className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                ✓ 설정됨
              </div>
            </div>
          )}

          {/* 계정 정보 */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">가입 계정</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">이메일</span>
              <span className="text-sm font-semibold text-zinc-900">{email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">이름</span>
              <span className="text-sm font-semibold text-zinc-900">{fullName}</span>
            </div>
          </div>

          {/* Supabase 이메일 확인 안내 */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800 space-y-1">
            <p className="font-bold">📧 이메일 인증을 확인하세요</p>
            <p className="text-xs text-amber-700">
              <strong>{email}</strong>로 인증 메일이 발송됐습니다.<br />
              메일의 링크를 클릭한 후 로그인하세요.
            </p>
          </div>

          {/* 로그인 버튼 */}
          <Link
            href="/login"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition shadow-lg shadow-blue-200"
          >
            로그인하러 가기 →
          </Link>

          <p className="text-center text-xs text-zinc-400">
            이메일 인증 후 로그인 가능합니다
          </p>
        </div>
      </div>
    );
  }

  /* ── 회원가입 폼 ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-blue-950 to-zinc-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">💪</span>
            </div>
            <span className="text-2xl font-black text-white">FitBoss</span>
          </Link>
          <p className="text-zinc-400 text-sm">피트니스 비즈니스 경영 플랫폼</p>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center mb-6 px-2">
          {(["info", "biztype"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                  step === s
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/40"
                    : step === "biztype" && s === "info"
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-zinc-400"
                }`}>
                  {step === "biztype" && s === "info" ? "✓" : i + 1}
                </div>
                <span className={`text-xs font-semibold ${
                  step === s ? "text-white" : "text-zinc-500"
                }`}>
                  {s === "info" ? "기본 정보" : "사업자 유형"}
                </span>
              </div>
              {i === 0 && <div className="flex-1 h-px bg-white/10 mx-3" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: 기본 정보 ── */}
        {step === "info" && (
          <form onSubmit={handleInfoNext} className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-black text-white">기본 정보 입력</h2>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">이름 *</label>
              <input
                type="text" placeholder="홍길동" value={fullName} required
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">이메일 *</label>
              <input
                type="email" placeholder="example@gym.com" value={email} required
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">비밀번호 * <span className="text-zinc-500">(8자 이상)</span></label>
              <input
                type="password" placeholder="••••••••" value={password} required
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">비밀번호 확인 *</label>
              <input
                type="password" placeholder="••••••••" value={confirm} required
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!email || !password || !fullName || !confirm}
              className="w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white hover:bg-blue-500 disabled:opacity-40 transition"
            >
              다음 →
            </button>
          </form>
        )}

        {/* ── STEP 2: 사업자 유형 ── */}
        {step === "biztype" && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-black text-white">어떤 시설을 운영하시나요?</h2>
              <p className="text-xs text-zinc-400 mt-1">유형에 맞는 기능만 표시됩니다. 이후 설정에서 변경 가능합니다.</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {BUSINESS_TYPE_LIST.map((bt) => {
                const cfg = BUSINESS_CONFIGS[bt];
                const selected = bizType === bt;
                return (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => setBizType(bt)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                      selected
                        ? "border-blue-400 bg-blue-500/20"
                        : "border-white/10 hover:border-white/20 hover:bg-white/5"
                    }`}
                  >
                    <span className="text-2xl">{cfg.icon}</span>
                    <span className={`text-xs font-bold ${selected ? "text-blue-300" : "text-zinc-300"}`}>
                      {cfg.label}
                    </span>
                    {selected && (
                      <span className="text-[9px] text-blue-400 font-bold">✓ 선택</span>
                    )}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300 font-medium">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep("info"); setError(""); }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-zinc-300 text-sm font-semibold hover:bg-white/5 transition"
              >
                ← 이전
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!bizType || loading}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />가입 중...</>
                ) : "가입 완료 🎉"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-zinc-500 mt-5">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-blue-400 font-semibold hover:text-blue-300">로그인</Link>
        </p>
      </div>
    </div>
  );
}
