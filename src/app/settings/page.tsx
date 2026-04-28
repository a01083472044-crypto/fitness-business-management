"use client";

import { useState, useEffect } from "react";
import { useStaffTerm, STAFF_PRESETS } from "../context/StaffTermContext";
import {
  KakaoStore, kakaoLogin, kakaoLogout,
  silentRefreshToken, sendKakaoMemo, initKakao, syncSWSchedule,
} from "../lib/kakao";

// ── 연결 상태 타입 ────────────────────────────────────────────────────────
type ConnStatus = "connected" | "expired" | "none";

function getConnStatus(): ConnStatus {
  if (!KakaoStore.getToken()) return "none";
  if (KakaoStore.isTokenExpired()) return "expired";
  return "connected";
}

export default function SettingsPage() {
  const { staffTerm, setStaffTerm } = useStaffTerm();
  const [customInput, setCustomInput] = useState("");
  const [saved,       setSaved]       = useState(false);

  // ── 카카오 상태 ──────────────────────────────────────────────────────────
  const [appKey,       setAppKey]       = useState("");
  const [appKeySaved,  setAppKeySaved]  = useState(false);
  const [connStatus,   setConnStatus]   = useState<ConnStatus>("none");
  const [autoEnabled,  setAutoEnabled]  = useState(false);
  const [autoTime,     setAutoTime]     = useState("20:00");
  const [lastSent,     setLastSent]     = useState("");
  const [linkedAt,     setLinkedAt]     = useState("");
  const [kakaoMsg,     setKakaoMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [notifPerm,    setNotifPerm]    = useState<NotificationPermission>("default");
  const [showGuide,    setShowGuide]    = useState(false);

  useEffect(() => {
    setAppKey(KakaoStore.getAppKey());
    setConnStatus(getConnStatus());
    setAutoEnabled(KakaoStore.isEnabled());
    setAutoTime(KakaoStore.getTime());
    setLastSent(KakaoStore.getLastSent());
    setLinkedAt(KakaoStore.getLinkedAt());
    if (typeof Notification !== "undefined") setNotifPerm(Notification.permission);

    // 앱 키 있고 토큰 만료 임박 → 자동 갱신 시도
    if (KakaoStore.getToken() && KakaoStore.isTokenExpired()) {
      silentRefreshToken().then((ok) => {
        if (ok) setConnStatus("connected");
      });
    }
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

  // ── 헬퍼 ──────────────────────────────────────────────────────────────────
  function showMsg(text: string, ok = true) {
    setKakaoMsg({ text, ok });
    setTimeout(() => setKakaoMsg(null), 5000);
  }

  // ── 앱 키 저장 ────────────────────────────────────────────────────────────
  function saveAppKey() {
    KakaoStore.setAppKey(appKey.trim());
    setAppKeySaved(true);
    setTimeout(() => setAppKeySaved(false), 2000);
    showMsg("✅ 앱 키가 저장됐습니다.");
  }

  // ── 카카오 로그인 ─────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!appKey.trim()) { showMsg("⚠️ 먼저 앱 키를 입력·저장해 주세요.", false); return; }
    setLoading(true);
    try {
      await kakaoLogin(appKey.trim());
      setConnStatus("connected");
      setLinkedAt(KakaoStore.getLinkedAt());
      showMsg("✅ 카카오 연동 완료! 이제 자동 전송이 가능합니다.");
    } catch (e) {
      showMsg(`❌ ${(e as Error).message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ── 토큰 자동 갱신 ────────────────────────────────────────────────────────
  async function handleRefresh() {
    setLoading(true);
    showMsg("🔄 연결 갱신 중...");
    const ok = await silentRefreshToken();
    if (ok) {
      setConnStatus("connected");
      showMsg("✅ 카카오 연결이 갱신됐습니다. (토큰 6시간 연장)");
    } else {
      setConnStatus("expired");
      showMsg("⚠️ 자동 갱신 실패 — 아래 '다시 로그인' 버튼을 눌러 주세요.", false);
    }
    setLoading(false);
  }

  // ── 테스트 전송 ───────────────────────────────────────────────────────────
  async function handleTestSend() {
    if (connStatus !== "connected") { showMsg("⚠️ 먼저 카카오를 연동해 주세요.", false); return; }
    setLoading(true);
    try {
      await initKakao();
      const today = new Date().toISOString().slice(0, 10);
      await sendKakaoMemo(
        `✅ 카카오 자동 전송 연결 확인\n\n` +
        `📅 설정 시각: 매일 ${autoTime}\n` +
        `📆 연동일: ${linkedAt || today}\n` +
        `🕐 전송 시각: ${new Date().toLocaleTimeString("ko-KR")}\n\n` +
        `이 메시지가 수신됐다면 자동 전송이 정상 작동합니다!\n` +
        `📱 FitBoss`
      );
      showMsg("✅ 테스트 메시지가 카카오톡으로 전송됐습니다!");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("끊어졌") || msg.includes("만료")) {
        setConnStatus("expired");
      }
      showMsg(`❌ ${msg}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ── 로그아웃 ─────────────────────────────────────────────────────────────
  function handleLogout() {
    kakaoLogout();
    setConnStatus("none");
    setAutoEnabled(false);
    KakaoStore.setEnabled(false);
    showMsg("카카오 연동이 해제됐습니다.", false);
  }

  // ── 자동 전송 토글 ────────────────────────────────────────────────────────
  function toggleAuto(v: boolean) {
    if (v && connStatus !== "connected") {
      showMsg("⚠️ 카카오 연동 후 사용할 수 있습니다.", false);
      return;
    }
    setAutoEnabled(v);
    KakaoStore.setEnabled(v);
    syncSWSchedule();
    showMsg(v ? `✅ 매일 ${autoTime}에 자동 전송됩니다.` : "자동 전송이 꺼졌습니다.");
  }

  // ── 전송 시간 변경 ────────────────────────────────────────────────────────
  function handleTimeChange(t: string) {
    setAutoTime(t);
    KakaoStore.setTime(t);
    if (autoEnabled) { syncSWSchedule(); showMsg(`✅ 전송 시간이 ${t}으로 변경됐습니다.`); }
  }

  // ── 알림 권한 요청 ────────────────────────────────────────────────────────
  async function requestNotifPerm() {
    if (typeof Notification === "undefined") { showMsg("⚠️ 이 브라우저는 알림을 지원하지 않습니다.", false); return; }
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    showMsg(perm === "granted"
      ? "✅ 알림 허용됨 — 앱이 닫혀도 전송 알림을 받을 수 있습니다."
      : "⚠️ 알림이 거부됐습니다. 앱이 열려 있을 때만 작동합니다.", perm === "granted");
  }

  // ── 상태 UI 헬퍼 ─────────────────────────────────────────────────────────
  const statusConfig = {
    connected: { color: "bg-emerald-50 border-emerald-200", icon: "✅", label: "연동됨", text: "text-emerald-700" },
    expired:   { color: "bg-orange-50 border-orange-200",   icon: "⚠️", label: "갱신 필요", text: "text-orange-700" },
    none:      { color: "bg-zinc-50 border-zinc-200",       icon: "○",  label: "미연동", text: "text-zinc-500" },
  }[connStatus];

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-black text-zinc-900">앱 설정</h1>
          <p className="text-sm text-zinc-500 mt-0.5">카카오 자동 전송 · 직원 호칭 설정</p>
        </div>

        {/* ══════════════════ 카카오 자동 전송 ══════════════════ */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-5">

          {/* 헤더 + 상태 */}
          <div className="flex items-center justify-between">
            <p className="font-bold text-zinc-900">💬 카카오톡 자동 전송</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusConfig.color} ${statusConfig.text}`}>
              {statusConfig.icon} {statusConfig.label}
            </span>
          </div>

          {/* ── 연동 완료 상태 카드 ──────────────────────────────────── */}
          {connStatus !== "none" && (
            <div className={`rounded-xl p-4 border ${connStatus === "connected" ? "bg-emerald-50 border-emerald-200" : "bg-orange-50 border-orange-200"} space-y-3`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-black ${connStatus === "connected" ? "text-emerald-800" : "text-orange-800"}`}>
                    {connStatus === "connected"
                      ? (autoEnabled ? `🚀 매일 ${autoTime} 자동 전송 중` : "✅ 연동됨 (자동 전송 OFF)")
                      : "⚠️ 토큰 만료 — 갱신이 필요합니다"}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-zinc-400">
                    {linkedAt && <span>연동일: {linkedAt}</span>}
                    {lastSent && <span>마지막 전송: {lastSent}</span>}
                  </div>
                </div>
              </div>

              {/* 액션 버튼들 */}
              <div className="flex gap-2 flex-wrap">
                {connStatus === "connected" && (
                  <button onClick={handleTestSend} disabled={loading}
                    className="flex-1 py-2 bg-white border border-emerald-300 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 transition disabled:opacity-50">
                    {loading ? "⏳ 전송 중..." : "📨 테스트 전송"}
                  </button>
                )}
                {connStatus === "expired" && (
                  <button onClick={handleRefresh} disabled={loading}
                    className="flex-1 py-2 bg-white border border-orange-300 text-orange-700 text-xs font-bold rounded-xl hover:bg-orange-100 transition disabled:opacity-50">
                    {loading ? "⏳ 갱신 중..." : "🔄 자동 갱신 시도"}
                  </button>
                )}
                <button onClick={handleLogout}
                  className="px-4 py-2 bg-white border border-zinc-200 text-zinc-400 text-xs font-bold rounded-xl hover:bg-zinc-50 hover:text-zinc-600 transition">
                  연동 해제
                </button>
              </div>

              {connStatus === "expired" && (
                <button onClick={handleLogin} disabled={loading || !appKey.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-400 text-zinc-900 font-bold py-3 rounded-xl hover:bg-yellow-300 disabled:opacity-40 transition text-sm">
                  💬 다시 로그인
                </button>
              )}
            </div>
          )}

          {/* ── STEP 1: 앱 키 ──────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 ${
                  appKey ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"
                }`}>1</span>
                <p className="text-sm font-bold text-zinc-700">카카오 앱 키 등록</p>
              </div>
              <button onClick={() => setShowGuide(!showGuide)}
                className="text-xs text-blue-500 underline">{showGuide ? "닫기" : "발급 방법 보기"}</button>
            </div>

            {showGuide && (
              <div className="ml-7 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 space-y-2">
                <p className="font-bold text-blue-900">📌 Kakao JavaScript 앱 키 발급 (1회만)</p>
                <ol className="space-y-1.5 list-none">
                  <li className="flex gap-2"><span className="font-black text-blue-600 flex-shrink-0">①</span>
                    <span><a href="https://developers.kakao.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">developers.kakao.com</a> 로그인</span>
                  </li>
                  <li className="flex gap-2"><span className="font-black text-blue-600 flex-shrink-0">②</span>
                    <span>내 애플리케이션 → <strong>애플리케이션 추가하기</strong></span>
                  </li>
                  <li className="flex gap-2"><span className="font-black text-blue-600 flex-shrink-0">③</span>
                    <span>앱 설정 → 플랫폼 → <strong>Web 사이트 도메인 등록</strong><br/>
                      <span className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">https://[내 도메인]</span></span>
                  </li>
                  <li className="flex gap-2"><span className="font-black text-blue-600 flex-shrink-0">④</span>
                    <span>앱 설정 → <strong>앱 키 → JavaScript 키</strong> 복사</span>
                  </li>
                  <li className="flex gap-2"><span className="font-black text-blue-600 flex-shrink-0">⑤</span>
                    <span>카카오 로그인 → 활성화 설정 ON<br/>
                    Redirect URI: <span className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">https://[내 도메인]</span></span>
                  </li>
                </ol>
                <p className="text-blue-600 bg-blue-100 rounded-lg p-2">
                  💡 한 번만 설정하면 이후 카카오 세션이 유지되는 동안 (약 60일) 자동 갱신됩니다
                </p>
              </div>
            )}

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
          </div>

          {/* ── STEP 2: 로그인 (미연동 상태일 때만 표시) ─────────────── */}
          {connStatus === "none" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 bg-zinc-200 text-zinc-500">2</span>
                <p className="text-sm font-bold text-zinc-700">카카오 계정 연동</p>
              </div>
              <div className="ml-7">
                <button onClick={handleLogin} disabled={loading || !appKey.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-400 text-zinc-900 font-bold py-3.5 rounded-xl hover:bg-yellow-300 disabled:opacity-40 transition text-sm">
                  {loading
                    ? <span className="w-4 h-4 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />
                    : "💬"
                  }
                  {loading ? "연동 중..." : "카카오톡으로 로그인 · 연동"}
                </button>
                <p className="text-xs text-zinc-400 mt-2 text-center">
                  연동 후 매일 자금일보가 내 카카오톡으로 자동 발송됩니다
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 3: 자동 전송 설정 ──────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 ${
                autoEnabled && connStatus === "connected" ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"
              }`}>{connStatus === "none" ? "3" : "2"}</span>
              <p className="text-sm font-bold text-zinc-700">매일 자동 전송 설정</p>
            </div>
            <div className="ml-7 space-y-3">

              {/* ON/OFF 토글 */}
              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <div>
                  <p className="text-sm font-semibold text-zinc-700">자동 전송</p>
                  <p className="text-xs text-zinc-400 mt-0.5">매일 설정 시각에 카카오톡 나에게 보내기</p>
                </div>
                <button onClick={() => toggleAuto(!autoEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative overflow-hidden flex-shrink-0 ${
                    autoEnabled && connStatus === "connected" ? "bg-yellow-400" : "bg-zinc-200"
                  }`}>
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    autoEnabled && connStatus === "connected" ? "translate-x-6" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {/* 전송 시간 */}
              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <div>
                  <p className="text-sm font-semibold text-zinc-700">전송 시각</p>
                  <p className="text-xs text-zinc-400 mt-0.5">매일 이 시각에 자금일보 전송</p>
                </div>
                <input type="time" value={autoTime} onChange={(e) => handleTimeChange(e.target.value)}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold text-zinc-700 focus:outline-none focus:border-yellow-400 bg-white" />
              </div>

            </div>
          </div>

          {/* ── STEP 4: 알림 권한 ────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 ${
                notifPerm === "granted" ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"
              }`}>{connStatus === "none" ? "4" : "3"}</span>
              <p className="text-sm font-bold text-zinc-700">백그라운드 알림 권한 <span className="text-zinc-400 font-normal">(권장)</span></p>
            </div>
            <div className="ml-7">
              {notifPerm === "granted" ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-semibold">
                  ✅ 허용됨 — 앱이 닫혀도 전송 알림을 받을 수 있습니다
                </div>
              ) : (
                <div className="space-y-2">
                  <button onClick={requestNotifPerm}
                    className="w-full py-2.5 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-bold rounded-xl hover:bg-blue-100 transition">
                    🔔 알림 권한 허용하기
                  </button>
                  <p className="text-xs text-zinc-400">
                    {notifPerm === "denied"
                      ? "⚠️ 브라우저 설정에서 알림을 허용해 주세요."
                      : "허용하면 앱이 닫혀 있어도 전송 시각에 알림이 옵니다."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 동작 안내 */}
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-xs text-yellow-800 space-y-2">
            <p className="font-bold">💬 자동 전송 동작 방식</p>
            <div className="space-y-1">
              <p>· <strong>앱 열려 있을 때:</strong> 설정 시각에 즉시 카카오톡 전송</p>
              <p>· <strong>앱 닫혀 있을 때:</strong> 알림 표시 → 탭하면 앱 열리며 자동 전송</p>
              <p>· <strong>토큰 만료 시:</strong> Kakao 세션으로 자동 갱신 후 전송 (재로그인 불필요)</p>
            </div>
            <p className="text-yellow-600 border-t border-yellow-200 pt-2">
              * 하루 1회만 전송 · 중복 전송 없음<br/>
              * Kakao 세션 유지 기간 약 60일 (만료 시 재연동 필요)
            </p>
          </div>

          {/* 상태 메시지 */}
          {kakaoMsg && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              kakaoMsg.ok
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-red-50 border border-red-200 text-red-600"
            }`}>
              {kakaoMsg.text}
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
