/* Kakao JavaScript SDK 래퍼 — 나에게 보내기 */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Kakao: any;
  }
}

const SDK_URL           = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
const KEY_APP_KEY       = "kakao_app_key";
const KEY_TOKEN         = "kakao_access_token";
const KEY_REFRESH_TOKEN = "kakao_refresh_token";
const KEY_AUTO_TIME     = "kakao_auto_time";
const KEY_AUTO_ON       = "kakao_auto_enabled";
const KEY_LAST_SENT     = "kakao_last_sent";
const KEY_TOKEN_EXP     = "kakao_token_exp"; // 만료 timestamp (ms)
const KEY_LINKED_AT     = "kakao_linked_at"; // 연동일 (YYYY-MM-DD)

// ── localStorage 헬퍼 ────────────────────────────────────────────────────
export const KakaoStore = {
  getAppKey:       () => (typeof window !== "undefined" ? localStorage.getItem(KEY_APP_KEY)       || "" : ""),
  setAppKey:       (v: string) => localStorage.setItem(KEY_APP_KEY, v),
  getToken:        () => (typeof window !== "undefined" ? localStorage.getItem(KEY_TOKEN)         || "" : ""),
  setToken:        (v: string) => localStorage.setItem(KEY_TOKEN, v),
  clearToken:      () => {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_REFRESH_TOKEN);
    localStorage.removeItem(KEY_TOKEN_EXP);
  },
  getRefreshToken: () => (typeof window !== "undefined" ? localStorage.getItem(KEY_REFRESH_TOKEN) || "" : ""),
  setRefreshToken: (v: string) => localStorage.setItem(KEY_REFRESH_TOKEN, v),
  getTokenExp:     () => (typeof window !== "undefined" ? Number(localStorage.getItem(KEY_TOKEN_EXP) || "0") : 0),
  setTokenExp:     (expiresInSec: number) =>
    localStorage.setItem(KEY_TOKEN_EXP, String(Date.now() + expiresInSec * 1000)),
  isTokenExpired:  () => {
    const exp = typeof window !== "undefined" ? Number(localStorage.getItem(KEY_TOKEN_EXP) || "0") : 0;
    return exp > 0 && Date.now() > exp - 120_000; // 2분 여유
  },
  getLinkedAt:     () => (typeof window !== "undefined" ? localStorage.getItem(KEY_LINKED_AT) || "" : ""),
  setLinkedAt:     () => localStorage.setItem(KEY_LINKED_AT, new Date().toISOString().slice(0, 10)),
  getTime:         () => (typeof window !== "undefined" ? localStorage.getItem(KEY_AUTO_TIME)     || "20:00" : "20:00"),
  setTime:         (v: string) => localStorage.setItem(KEY_AUTO_TIME, v),
  isEnabled:       () => (typeof window !== "undefined" ? localStorage.getItem(KEY_AUTO_ON)       === "true" : false),
  setEnabled:      (v: boolean) => localStorage.setItem(KEY_AUTO_ON, String(v)),
  getLastSent:     () => (typeof window !== "undefined" ? localStorage.getItem(KEY_LAST_SENT)     || "" : ""),
  markSent:        () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(KEY_LAST_SENT, today);
    return today;
  },
  isSentToday: () => {
    const today = new Date().toISOString().slice(0, 10);
    return (typeof window !== "undefined" ? localStorage.getItem(KEY_LAST_SENT) : "") === today;
  },
};

// ── SDK 동적 로드 ─────────────────────────────────────────────────────────
let sdkLoading: Promise<void> | null = null;
export function loadKakaoSDK(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Kakao) return Promise.resolve();
  if (sdkLoading) return sdkLoading;

  sdkLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error("카카오 SDK 로드 실패"));
    document.head.appendChild(s);
  });
  return sdkLoading;
}

// ── 초기화 ────────────────────────────────────────────────────────────────
export async function initKakao(appKey?: string): Promise<void> {
  await loadKakaoSDK();
  const key = appKey || KakaoStore.getAppKey();
  if (!key) throw new Error("카카오 앱 키가 설정되지 않았습니다");

  if (!window.Kakao.isInitialized()) window.Kakao.init(key);

  const token = KakaoStore.getToken();
  if (token) window.Kakao.Auth.setAccessToken(token);
}

// ── 로그인 (팝업) — refresh_token + 만료 시각 함께 저장 ──────────────────
export async function kakaoLogin(appKey: string): Promise<string> {
  await initKakao(appKey);
  return new Promise((resolve, reject) => {
    window.Kakao.Auth.login({
      success: (auth: {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        refresh_token_expires_in?: number;
      }) => {
        KakaoStore.setToken(auth.access_token);
        if (auth.refresh_token)  KakaoStore.setRefreshToken(auth.refresh_token);
        if (auth.expires_in)     KakaoStore.setTokenExp(auth.expires_in);
        KakaoStore.setLinkedAt();
        resolve(auth.access_token);
      },
      fail: (err: unknown) => reject(new Error(`카카오 로그인 실패: ${JSON.stringify(err)}`)),
    });
  });
}

// ── 무음 토큰 갱신 — Kakao 세션(쿠키) 기반, 재로그인 없이 ─────────────────
// Kakao 세션이 살아 있으면 브라우저 쿠키를 통해 새 액세스 토큰을 조용히 발급
// 보통 60~90일간 유효 → 재로그인 없이 자동 전송 유지 가능
export async function silentRefreshToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    await loadKakaoSDK();
    const key = KakaoStore.getAppKey();
    if (!key) return false;
    if (!window.Kakao.isInitialized()) window.Kakao.init(key);
    if (!window.Kakao?.Auth) return false;

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5000); // 5초 타임아웃
      window.Kakao.Auth.getStatusInfo((obj: { status: string }) => {
        clearTimeout(timer);
        if (obj.status === "connected") {
          const newToken = window.Kakao.Auth.getAccessToken();
          if (newToken) {
            KakaoStore.setToken(newToken);
            KakaoStore.setTokenExp(21600); // 6시간
            resolve(true);
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    });
  } catch {
    return false;
  }
}

// ── 로그아웃 ─────────────────────────────────────────────────────────────
export function kakaoLogout(): void {
  try { if (window.Kakao?.Auth) window.Kakao.Auth.logout(); } catch {}
  KakaoStore.clearToken();
}

// ── 나에게 보내기 — 토큰 만료 시 자동 갱신 후 재시도 ─────────────────────
export async function sendKakaoMemo(text: string, _retried = false): Promise<void> {
  // 만료 임박이면 먼저 조용히 갱신
  if (!_retried && KakaoStore.isTokenExpired()) {
    await silentRefreshToken();
  }

  const token = KakaoStore.getToken();
  if (!token) throw new Error("카카오 로그인이 필요합니다");

  const body = new URLSearchParams({
    template_object: JSON.stringify({
      object_type: "text",
      text: text.slice(0, 2000),
      link: { web_url: typeof window !== "undefined" ? window.location.origin : "https://example.com" },
    }),
  });

  const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KakaoStore.getToken()}`, // 갱신 후 토큰 재조회
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.code === -401) {
      if (!_retried) {
        // -401 받으면 한 번 더 갱신 시도 후 재전송
        const refreshed = await silentRefreshToken();
        if (refreshed) return sendKakaoMemo(text, true);
      }
      KakaoStore.clearToken();
      throw new Error("카카오 연결이 끊어졌습니다. 설정에서 다시 로그인해 주세요.");
    }
    throw new Error(data.msg || `전송 실패 (${res.status})`);
  }
}

// ── Service Worker에 스케줄 설정 전달 ────────────────────────────────────
export function syncSWSchedule(): void {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type:     "SCHEDULE_UPDATE",
    enabled:  KakaoStore.isEnabled(),
    time:     KakaoStore.getTime(),
    lastSent: KakaoStore.getLastSent(),
  });
}

export function notifySWSent(): void {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: "MARK_SENT",
    date: new Date().toISOString().slice(0, 10),
  });
}
