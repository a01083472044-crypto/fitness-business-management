"use client";

import { useState, useEffect } from "react";
import { useStaffTerm, STAFF_PRESETS } from "../context/StaffTermContext";
import {
  KakaoStore, kakaoLogin, kakaoLogout, syncSWSchedule,
} from "../lib/kakao";

export default function SettingsPage() {
  const { staffTerm, setStaffTerm } = useStaffTerm();
  const [customInput, setCustomInput] = useState("");
  const [saved, setSaved] = useState(false);

  // ── 카카오 상태 ──────────────────────────────────────────────────────────
  const [appKey,    setAppKey]    = useState("");
  const [appKeySaved, setAppKeySaved] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoTime,   setAutoTime]   = useState("20:00");
  const [lastSent,   setLastSent]   = useState("");
  const [kakaoMsg,   setKakaoMsg]   = useState("");
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [notifPerm,  setNotifPerm]  = useState<NotificationPermission>("default");

  useEffect(() => {
    setAppKey(KakaoStore.getAppKey());
    setIsLoggedIn(!!KakaoStore.getToken());
    setAutoEnabled(KakaoStore.isEnabled());
    setAutoTime(KakaoStore.getTime());
    setLastSent(KakaoStore.getLastSent());
    if (typeof Notification !== "undefined") setNotifPerm(Notification.permission);
  }, []);

  // ── 직원 호칭 ────────────────────────────────────────────────────────────
  const isCustom    = !STAFF_PRESETS.slice(0, -1).some((p) => p.term === staffTerm);
  const activeCustom = isCustom ? staffTerm : "";

  const handlePreset = (term: string) => {
    setStaffTerm(term);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const handleCustomSave = () => {
    const val = customInput.trim();
    if (!val) return;
    setStaffTerm(val);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── 카카오 앱 키 저장 ─────────────────────────────────────────────────────
  function saveAppKey() {
    KakaoStore.setAppKey(appKey.trim());
    setAppKeySaved(true);
    setTimeout(() => setAppKeySaved(false), 2000);
    showKakaoMsg("✅ 앱 키가 저장됐습니다.");
  }

  // ── 카카오 로그인 ─────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!appKey.trim()) { showKakaoMsg("⚠️ 먼저 카카오 앱 키를 입력·저장하세요."); return; }
    setKakaoLoading(true);
    try {
      await kakaoLogin(appKey.trim());
      setIsLoggedIn(true);
      showKakaoMsg("✅ 카카오 로그인 성공! 이제 자동 전송이 가능합니다.");
    } catch (e) {
      showKakaoMsg(`❌ ${(e as Error).message}`);
    } finally {
      setKakaoLoading(false);
    }
  }

  // ── 카카오 로그아웃 ───────────────────────────────────────────────────────
  function handleLogout() {
    kakaoLogout();
    setIsLoggedIn(false);
    setAutoEnabled(false);
    KakaoStore.setEnabled(false);
    showKakaoMsg("로그아웃됐습니다.");
  }

  // ── 자동 전송 토글 ────────────────────────────────────────────────────────
  function toggleAuto(v: boolean) {
    if (v && !isLoggedIn) { showKakaoMsg("⚠️ 카카오 로그인 후 사용 가능합니다."); return; }
    setAutoEnabled(v);
    KakaoStore.setEnabled(v);
    syncSWSchedule();
    showKakaoMsg(v ? `✅ 매일 ${autoTime}에 자동 전송됩니다.` : "자동 전송이 꺼졌습니다.");
  }

  // ── 전송 시간 변경 ────────────────────────────────────────────────────────
  function handleTimeChange(t: string) {
    setAutoTime(t);
    KakaoStore.setTime(t);
    if (autoEnabled) { syncSWSchedule(); showKakaoMsg(`✅ 전송 시간이 ${t}으로 변경됐습니다.`); }
  }

  // ── 알림 권한 요청 ────────────────────────────────────────────────────────
  async function requestNotifPerm() {
    if (typeof Notification === "undefined") { showKakaoMsg("⚠️ 이 브라우저는 알림을 지원하지 않습니다."); return; }
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") showKakaoMsg("✅ 알림 권한이 허용됐습니다. 앱이 닫혀도 알림을 받을 수 있습니다.");
    else showKakaoMsg("⚠️ 알림 권한이 거부됐습니다. 앱이 열려 있을 때만 자동 전송됩니다.");
  }

  function showKakaoMsg(msg: string) {
    setKakaoMsg(msg);
    setTimeout(() => setKakaoMsg(""), 4000);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-black text-zinc-900">앱 설정</h1>
          <p className="text-sm text-zinc-500 mt-0.5">직원 호칭 · 카카오 자동 전송 설정</p>
        </div>

        {/* ══════════════════ 카카오 자동 전송 ══════════════════ */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-zinc-900">💬 카카오톡 자동 전송</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              autoEnabled && isLoggedIn ? "bg-yellow-100 text-yellow-700" : "bg-zinc-100 text-zinc-500"
            }`}>
              {autoEnabled && isLoggedIn ? `매일 ${autoTime} 자동 전송` : "OFF"}
            </span>
          </div>

          {/* STEP 1: 앱 키 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 ${appKey ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"}`}>1</span>
              <p className="text-sm font-bold text-zinc-700">카카오 앱 키 입력</p>
            </div>
            <p className="text-xs text-zinc-400 ml-7">
              <a href="https://developers.kakao.com" target="_blank" rel="noopener noreferrer"
                className="text-blue-500 underline">developers.kakao.com</a>
              {" "}→ 내 애플리케이션 → 앱 설정 → 앱 키 → JavaScript 키
            </p>
            <div className="flex gap-2 ml-7">
              <input
                type="text"
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
                placeholder="JavaScript 앱 키 붙여넣기"
                className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-400"
              />
              <button onClick={saveAppKey} disabled={!appKey.trim()}
                className="px-4 py-2.5 bg-zinc-900 text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:bg-zinc-700 transition">
                {appKeySaved ? "✓" : "저장"}
              </button>
            </div>
            <div className="ml-7 bg-zinc-50 rounded-xl p-3 text-xs text-zinc-500 space-y-1">
              <p className="font-semibold">📌 앱 키 발급 방법</p>
              <p>1. developers.kakao.com 로그인</p>
              <p>2. 내 애플리케이션 → 애플리케이션 추가</p>
              <p>3. 앱 설정 → 플랫폼 → Web 플랫폼 → 사이트 도메인 등록</p>
              <p>4. 앱 설정 → 앱 키 → JavaScript 키 복사</p>
            </div>
          </div>

          {/* STEP 2: 로그인 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 ${isLoggedIn ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"}`}>2</span>
              <p className="text-sm font-bold text-zinc-700">카카오 계정 로그인</p>
            </div>
            <div className="ml-7">
              {!isLoggedIn ? (
                <button onClick={handleLogin} disabled={kakaoLoading || !appKey.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-400 text-zinc-900 font-bold py-3 rounded-xl hover:bg-yellow-300 disabled:opacity-40 transition text-sm">
                  {kakaoLoading ? (
                    <span className="w-4 h-4 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />
                  ) : "💬"} 카카오톡으로 로그인
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700 font-semibold">
                    ✅ 로그인 완료
                  </div>
                  <button onClick={handleLogout}
                    className="px-4 py-2.5 bg-zinc-100 text-zinc-500 text-sm font-bold rounded-xl hover:bg-zinc-200 transition">
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* STEP 3: 자동 전송 설정 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 ${autoEnabled && isLoggedIn ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"}`}>3</span>
              <p className="text-sm font-bold text-zinc-700">매일 자동 전송 설정</p>
            </div>
            <div className="ml-7 space-y-3">
              {/* ON/OFF 토글 */}
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-zinc-700">자동 전송</p>
                  <p className="text-xs text-zinc-400">매일 설정 시간에 카카오톡 나에게 보내기</p>
                </div>
                <button onClick={() => toggleAuto(!autoEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative overflow-hidden ${autoEnabled && isLoggedIn ? "bg-yellow-400" : "bg-zinc-200"}`}>
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoEnabled && isLoggedIn ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>

              {/* 전송 시간 */}
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-zinc-700">전송 시간</p>
                  <p className="text-xs text-zinc-400">매일 이 시간에 자동 전송</p>
                </div>
                <input type="time" value={autoTime} onChange={(e) => handleTimeChange(e.target.value)}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold text-zinc-700 focus:outline-none focus:border-yellow-400 bg-white" />
              </div>

              {/* 마지막 전송 */}
              {lastSent && (
                <p className="text-xs text-zinc-400 text-center">
                  마지막 전송: {lastSent}
                </p>
              )}
            </div>
          </div>

          {/* STEP 4: 알림 권한 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 ${notifPerm === "granted" ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"}`}>4</span>
              <p className="text-sm font-bold text-zinc-700">백그라운드 알림 권한</p>
            </div>
            <div className="ml-7">
              {notifPerm === "granted" ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700 font-semibold">
                  ✅ 알림 허용됨 — 앱이 닫혀도 알림을 받을 수 있습니다
                </div>
              ) : (
                <div className="space-y-2">
                  <button onClick={requestNotifPerm}
                    className="w-full py-2.5 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-bold rounded-xl hover:bg-blue-100 transition">
                    🔔 알림 권한 허용하기
                  </button>
                  <p className="text-xs text-zinc-400">
                    허용하면 앱이 닫혀 있어도 전송 시간에 알림이 옵니다.
                    {notifPerm === "denied" && " (브라우저 설정에서 알림을 허용해 주세요)"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 동작 설명 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-800 space-y-1.5">
            <p className="font-bold">💬 자동 전송 동작 방식</p>
            <p>· <strong>앱이 열려 있을 때</strong>: 설정 시간에 카카오톡으로 즉시 전송</p>
            <p>· <strong>앱이 백그라운드일 때</strong>: 알림 표시 → 탭하면 자동 전송</p>
            <p>· <strong>앱이 완전히 닫혔을 때</strong>: 알림 표시 → 탭 → 앱 열리며 전송</p>
            <p className="text-yellow-600">* 하루 1회만 전송되며 중복 전송 없음</p>
          </div>

          {/* 카카오 상태 메시지 */}
          {kakaoMsg && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${kakaoMsg.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {kakaoMsg}
            </div>
          )}
        </section>

        {/* ══════════════════ 직원 호칭 설정 ══════════════════ */}
        <div className="bg-blue-600 rounded-2xl p-5 text-white">
          <p className="text-xs text-blue-200 mb-1">현재 적용된 호칭</p>
          <p className="text-3xl font-black">{staffTerm}</p>
          <p className="text-xs text-blue-200 mt-1">네비게이션 · 모든 페이지에 반영됩니다</p>
        </div>

        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <p className="font-bold text-zinc-900">사업 유형 선택</p>
          <div className="grid grid-cols-2 gap-3">
            {STAFF_PRESETS.slice(0, -1).map(({ type, term, icon }) => {
              const isActive = staffTerm === term && !isCustom;
              return (
                <button key={type} onClick={() => handlePreset(term)}
                  className={`rounded-xl border p-4 text-left transition ${isActive ? "bg-blue-50 border-blue-500" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}>
                  <p className="text-2xl mb-1">{icon}</p>
                  <p className={`text-xs font-semibold ${isActive ? "text-blue-700" : "text-zinc-500"}`}>{type}</p>
                  <p className={`text-base font-black mt-0.5 ${isActive ? "text-blue-700" : "text-zinc-800"}`}>{term}</p>
                  {isActive && <p className="text-xs text-blue-500 mt-1 font-semibold">✓ 적용 중</p>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <p className="font-bold text-zinc-900">✏️ 직접 입력</p>
          <div className="flex gap-2">
            <input type="text" placeholder={activeCustom || "예: 선생님, 인스트럭터..."}
              value={customInput} onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustomSave()}
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none transition" />
            <button onClick={handleCustomSave}
              className="px-5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 transition">
              적용
            </button>
          </div>
          {isCustom && <p className="text-xs text-blue-600 font-semibold">✓ 현재: {staffTerm}</p>}
        </section>

        {saved && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-sm font-semibold px-6 py-3 rounded-full shadow-lg z-50">
            ✓ &quot;{staffTerm}&quot; 호칭이 적용되었습니다
          </div>
        )}
      </div>
    </div>
  );
}
