/**
 * 카카오톡 공유 유틸
 * - 모바일: navigator.share() → 공유 시트에 카카오톡 포함
 * - 데스크톱: 클립보드 복사 후 안내
 */

export type ShareResult = "shared" | "copied" | "error";

export async function shareKakao(text: string, title = "피트니스 경영 현황"): Promise<ShareResult> {
  if (typeof navigator === "undefined") return "error";

  // Web Share API (모바일 지원, iOS/Android 카카오톡 포함)
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (e) {
      // 사용자 취소 (AbortError) → 오류로 처리 안 함
      if ((e as Error).name === "AbortError") return "error";
    }
  }

  // 폴백: 클립보드 복사
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    // execCommand 폴백
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    return "copied";
  }
}
