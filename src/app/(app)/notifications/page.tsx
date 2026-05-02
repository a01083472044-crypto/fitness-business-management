"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getMembers, getReceivables, getSchedules } from "../../lib/store";
import { sendKakaoMemo, initKakao, KakaoStore } from "../../lib/kakao";

/* ── 날짜 유틸 ── */
function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function today()    { return dateStr(new Date()); }
function daysFrom(base: string, n: number) {
  const d = new Date(base + "T00:00:00"); d.setDate(d.getDate() + n); return dateStr(d);
}
function daysUntil(target: string) {
  return Math.ceil((new Date(target + "T00:00:00").getTime() - new Date(today() + "T00:00:00").getTime()) / 86400000);
}
function daysSince(target: string) {
  return Math.floor((new Date(today() + "T00:00:00").getTime() - new Date(target + "T00:00:00").getTime()) / 86400000);
}
function fmtW(n: number) { return "₩" + Math.round(n).toLocaleString("ko-KR"); }

/* ── 알림 종류 ── */
type NotiType = "expiry_soon" | "expiry_today" | "expired_followup" | "unpaid" | "at_risk";

interface Notification {
  id: string;           // memberId + type + date
  memberId: string;
  memberName: string;
  phone: string;
  type: NotiType;
  detail: string;       // 상세 (만료일, 잔여 횟수 등)
  message: string;      // 발송할 메시지
  urgency: "high" | "medium" | "low";
}

/* ── localStorage 발송 이력 ── */
const SENT_KEY = "gym_noti_sent";
function getSentMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}"); } catch { return {}; }
}
function markSent(id: string) {
  const m = getSentMap(); m[id] = today(); localStorage.setItem(SENT_KEY, JSON.stringify(m));
}
function isSent(id: string): boolean {
  const m = getSentMap(); return m[id] === today();
}
function clearSent(id: string) {
  const m = getSentMap(); delete m[id]; localStorage.setItem(SENT_KEY, JSON.stringify(m));
}

/* ── 메시지 템플릿 ── */
const TEMPLATES: Record<NotiType, (name: string, detail: string, phone?: string) => string> = {
  expiry_soon: (name, detail) =>
`안녕하세요, ${name}님 😊
${detail} 예정입니다.

이번 기회에 재등록하시면 특별 혜택을 드립니다!
궁금하신 점은 편하게 연락 주세요 🙏`,

  expiry_today: (name, detail) =>
`안녕하세요, ${name}님!
오늘 ${detail} 만료됩니다.

계속 이용을 원하시면 오늘 방문 시 재등록 해주세요 💪
항상 응원합니다!`,

  expired_followup: (name, detail) =>
`안녕하세요, ${name}님 🙂
${detail} 지나셨네요.

다시 시작하실 의향이 있으시면 언제든지 연락 주세요!
재등록 시 특별 혜택 드립니다 😊`,

  unpaid: (name, detail) =>
`안녕하세요, ${name}님.
미납 금액 ${detail}이 확인됩니다.

편하신 시간에 처리 부탁드립니다.
문의사항은 연락 주세요 🙏`,

  at_risk: (name, detail) =>
`안녕하세요, ${name}님! 오랜만이에요 😊
마지막 수업 이후 ${detail}이 지났네요.

몸 상태는 어떠세요? 다음 수업 일정 잡아드릴까요?
언제든지 연락 주세요 💪`,
};

/* ── 타입별 설정 ── */
const TYPE_CONFIG: Record<NotiType, { label: string; icon: string; color: string; bgColor: string }> = {
  expiry_soon:      { label: "만료 임박",      icon: "⏰", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" },
  expiry_today:     { label: "오늘 만료",      icon: "📛", color: "text-red-700",    bgColor: "bg-red-50 border-red-200" },
  expired_followup: { label: "재등록 유도",    icon: "🔁", color: "text-violet-700", bgColor: "bg-violet-50 border-violet-200" },
  unpaid:           { label: "미수금",         icon: "💸", color: "text-amber-700",  bgColor: "bg-amber-50 border-amber-200" },
  at_risk:          { label: "결석 위험",      icon: "😴", color: "text-blue-700",   bgColor: "bg-blue-50 border-blue-200" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sentMap, setSentMap]   = useState<Record<string, string>>({});
  const [filter, setFilter]     = useState<NotiType | "전체">("전체");
  const [preview, setPreview]   = useState<Notification | null>(null);
  const [editMsg, setEditMsg]   = useState("");
  const [sending, setSending]   = useState<string | null>(null);
  const [toast, setToast]       = useState("");
  const [kakaoReady, setKakaoReady] = useState(false);

  /* ── 카카오 연결 확인 ── */
  useEffect(() => {
    setKakaoReady(!!KakaoStore.getToken());
  }, []);

  /* ── 알림 대상 탐지 ── */
  useEffect(() => {
    const members   = getMembers();
    const rcvs      = getReceivables();
    const schedules = getSchedules();
    const td        = today();
    const list: Notification[] = [];

    for (const m of members) {
      /* 헬스 회원권 만료 */
      for (const g of m.gymMemberships ?? []) {
        const diff = daysUntil(g.endDate);
        if (diff >= 0 && diff <= 3) {
          const type: NotiType = diff === 0 ? "expiry_today" : "expiry_soon";
          const detail = diff === 0 ? "헬스 회원권이 오늘" : `헬스 회원권이 ${diff}일 후`;
          list.push({
            id: `${m.id}_gym_${type}`,
            memberId: m.id, memberName: m.name, phone: m.phone, type,
            detail: `헬스 회원권 만료${diff === 0 ? "(오늘)" : ` D-${diff}`}`,
            message: TEMPLATES[type](m.name, detail),
            urgency: diff === 0 ? "high" : "medium",
          });
        }
        /* 만료 후 재등록 유도 (7~14일) */
        if (diff < 0 && diff >= -14) {
          list.push({
            id: `${m.id}_gym_expired_followup`,
            memberId: m.id, memberName: m.name, phone: m.phone,
            type: "expired_followup",
            detail: `헬스 회원권 만료 ${Math.abs(diff)}일 경과`,
            message: TEMPLATES.expired_followup(m.name, `회원권 만료 후 ${Math.abs(diff)}일이`),
            urgency: "low",
          });
        }
      }

      /* PT 잔여 횟수 임박 */
      for (const p of m.packages ?? []) {
        const remaining = p.totalSessions - p.conductedSessions;
        if (remaining > 0 && remaining <= 3) {
          list.push({
            id: `${m.id}_pt_expiry_${p.id}`,
            memberId: m.id, memberName: m.name, phone: m.phone,
            type: remaining === 1 ? "expiry_today" : "expiry_soon",
            detail: `PT 잔여 ${remaining}회`,
            message: TEMPLATES[remaining === 1 ? "expiry_today" : "expiry_soon"](
              m.name, `PT 잔여 ${remaining}회`
            ),
            urgency: remaining === 1 ? "high" : "medium",
          });
        }
      }

      /* 미수금 */
      const myRcvs  = rcvs.filter((r) => !r.paid && r.memberName === m.name);
      if (myRcvs.length > 0) {
        const total = myRcvs.reduce((s, r) => s + r.amount, 0);
        list.push({
          id: `${m.id}_unpaid`,
          memberId: m.id, memberName: m.name, phone: m.phone,
          type: "unpaid",
          detail: `미수금 ${fmtW(total)}`,
          message: TEMPLATES.unpaid(m.name, fmtW(total)),
          urgency: "high",
        });
      }

      /* 결석 위험 (14일 이상 수업 없음) */
      const hasActive = (m.packages ?? []).some((p) => p.totalSessions - p.conductedSessions > 0);
      if (hasActive) {
        const lastDone = schedules
          .filter((s) => s.memberName === m.name && s.done)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const sinceDay = lastDone ? daysSince(lastDone.date) : 999;
        if (sinceDay >= 14) {
          list.push({
            id: `${m.id}_at_risk`,
            memberId: m.id, memberName: m.name, phone: m.phone,
            type: "at_risk",
            detail: `${sinceDay === 999 ? "첫 수업 미진행" : `${sinceDay}일째 미출석`}`,
            message: TEMPLATES.at_risk(m.name, sinceDay === 999 ? "등록 이후 시간" : `${sinceDay}일`),
            urgency: sinceDay >= 30 ? "high" : "medium",
          });
        }
      }
    }

    // 긴급도 순 정렬
    const order = { high: 0, medium: 1, low: 2 };
    list.sort((a, b) => order[a.urgency] - order[b.urgency]);
    setNotifications(list);
    setSentMap(getSentMap());
  }, []);

  /* ── 필터 적용 ── */
  const filtered = useMemo(() =>
    filter === "전체" ? notifications : notifications.filter((n) => n.type === filter),
    [notifications, filter]
  );

  const counts = useMemo(() => {
    const c: Partial<Record<NotiType | "전체", number>> = { 전체: notifications.length };
    for (const t of Object.keys(TYPE_CONFIG) as NotiType[]) {
      c[t] = notifications.filter((n) => n.type === t).length;
    }
    return c;
  }, [notifications]);

  /* ── 클립보드 복사 ── */
  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    markSent(id);
    setSentMap(getSentMap());
    showToast("📋 복사됐습니다! 카카오톡에 붙여넣기 하세요");
  };

  /* ── 카카오 나에게 보내기 (원장에게 요약 전송) ── */
  const sendToKakao = async (noti: Notification) => {
    setSending(noti.id);
    try {
      await initKakao(KakaoStore.getAppKey());
      const fullMsg = `📱 FitBoss 알림 발송 준비\n\n수신: ${noti.memberName} (${noti.phone})\n유형: ${TYPE_CONFIG[noti.type].label}\n\n${editMsg || noti.message}\n\n━━━━━━━━━━━━━\n위 내용을 회원에게 발송해주세요.`;
      await sendKakaoMemo(fullMsg);
      markSent(noti.id);
      setSentMap(getSentMap());
      showToast("✅ 카카오톡으로 전송됐습니다");
      setPreview(null);
    } catch (e) {
      showToast(`❌ ${(e as Error).message}`);
    } finally {
      setSending(null);
    }
  };

  /* ── 전체 일괄 발송 (나에게 요약) ── */
  const sendAllToKakao = async () => {
    if (!kakaoReady) { showToast("카카오 연결이 필요합니다"); return; }
    setSending("all");
    try {
      await initKakao(KakaoStore.getAppKey());
      const lines = [
        `📋 FitBoss 오늘의 알림 목록 (${today()})`,
        "━━━━━━━━━━━━━━━",
        ...filtered.slice(0, 20).map((n, i) =>
          `${i+1}. [${TYPE_CONFIG[n.type].label}] ${n.memberName} (${n.phone})\n   ${n.detail}`
        ),
        filtered.length > 20 ? `... 외 ${filtered.length - 20}건` : "",
        "━━━━━━━━━━━━━━━",
        "FitBoss에서 확인 후 발송하세요",
      ].filter(Boolean);
      await sendKakaoMemo(lines.join("\n"));
      showToast("✅ 알림 목록이 카카오톡으로 전송됐습니다");
    } catch (e) {
      showToast(`❌ ${(e as Error).message}`);
    } finally {
      setSending(null);
    }
  };

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">알림 관리</h1>
            <p className="text-sm text-zinc-400 mt-0.5">오늘 연락해야 할 회원 자동 탐지</p>
          </div>
          <div className="flex items-center gap-2">
            {kakaoReady ? (
              <button
                onClick={sendAllToKakao}
                disabled={!!sending || filtered.length === 0}
                className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-zinc-900 text-xs font-bold px-3 py-2 rounded-xl transition"
              >
                {sending === "all"
                  ? <span className="w-3 h-3 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />
                  : "📨"}
                카카오 전송
              </button>
            ) : (
              <Link href="/settings" className="text-xs text-blue-500 font-semibold border border-blue-200 px-3 py-2 rounded-xl">
                카카오 연결 →
              </Link>
            )}
          </div>
        </div>

        {/* 요약 통계 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
            <p className="text-xs text-red-500 font-semibold">긴급</p>
            <p className="text-2xl font-black text-red-600">
              {notifications.filter((n) => n.urgency === "high").length}
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
            <p className="text-xs text-amber-500 font-semibold">주의</p>
            <p className="text-2xl font-black text-amber-600">
              {notifications.filter((n) => n.urgency === "medium").length}
            </p>
          </div>
          <div className="bg-zinc-100 border border-zinc-200 rounded-2xl p-3 text-center">
            <p className="text-xs text-zinc-500 font-semibold">완료</p>
            <p className="text-2xl font-black text-zinc-600">
              {notifications.filter((n) => isSent(n.id)).length}
            </p>
          </div>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["전체", ...Object.keys(TYPE_CONFIG)] as (NotiType | "전체")[]).map((t) => {
            const count = counts[t] ?? 0;
            const cfg   = t !== "전체" ? TYPE_CONFIG[t as NotiType] : null;
            return (
              <button key={t} onClick={() => setFilter(t)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  filter === t
                    ? "bg-zinc-900 text-white"
                    : "bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300"
                }`}>
                {cfg?.icon} {cfg?.label ?? "전체"} {count > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* 알림 목록 */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-zinc-500 font-semibold">오늘 처리할 알림이 없습니다</p>
            <p className="text-xs text-zinc-400 mt-1">모든 회원 상태가 양호합니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((noti) => {
              const cfg  = TYPE_CONFIG[noti.type];
              const sent = isSent(noti.id);
              return (
                <div key={noti.id} className={`bg-white rounded-2xl border p-4 transition ${sent ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* 긴급도 표시 */}
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                        noti.urgency === "high" ? "bg-red-500" :
                        noti.urgency === "medium" ? "bg-amber-400" : "bg-zinc-300"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bgColor} ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          {sent && <span className="text-[10px] bg-emerald-100 text-emerald-600 font-bold px-2 py-0.5 rounded-full">✓ 완료</span>}
                        </div>
                        <p className="font-black text-zinc-900 mt-1">{noti.memberName}</p>
                        <p className="text-xs text-zinc-500">{noti.phone} · {noti.detail}</p>
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setPreview(noti);
                          setEditMsg(noti.message);
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl transition"
                      >
                        메시지 보기
                      </button>
                      <button
                        onClick={() => copyToClipboard(noti.message, noti.id)}
                        className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold px-3 py-1.5 rounded-xl transition"
                      >
                        📋 복사
                      </button>
                      {sent && (
                        <button
                          onClick={() => { clearSent(noti.id); setSentMap(getSentMap()); }}
                          className="text-[10px] text-zinc-400 hover:text-zinc-600 transition"
                        >
                          완료 취소
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 메시지 미리보기 모달 */}
        {preview && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm space-y-4 p-5 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-zinc-900">{preview.memberName}</p>
                  <p className="text-xs text-zinc-400">{preview.phone} · {TYPE_CONFIG[preview.type].label}</p>
                </div>
                <button onClick={() => setPreview(null)} className="text-zinc-400 hover:text-zinc-600 text-xl">✕</button>
              </div>

              {/* 메시지 편집 */}
              <div>
                <p className="text-xs font-bold text-zinc-400 mb-1.5">메시지 편집</p>
                <textarea
                  value={editMsg}
                  onChange={(e) => setEditMsg(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition resize-none"
                />
              </div>

              {/* 액션 버튼 */}
              <div className="space-y-2">
                <button
                  onClick={() => copyToClipboard(editMsg, preview.id)}
                  className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-bold py-3 rounded-2xl transition"
                >
                  📋 복사하고 카카오톡에 붙여넣기
                </button>
                {kakaoReady && (
                  <button
                    onClick={() => sendToKakao({ ...preview, message: editMsg })}
                    disabled={!!sending}
                    className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-zinc-900 font-bold py-3 rounded-2xl transition flex items-center justify-center gap-2"
                  >
                    {sending === preview.id
                      ? <><span className="w-4 h-4 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />전송 중...</>
                      : "📨 카카오톡 나에게 보내기"}
                  </button>
                )}
                <button
                  onClick={() => {
                    markSent(preview.id);
                    setSentMap(getSentMap());
                    setPreview(null);
                    showToast("✅ 발송 완료로 표시됐습니다");
                  }}
                  className="w-full border border-emerald-200 text-emerald-600 font-semibold py-2.5 rounded-2xl hover:bg-emerald-50 transition text-sm"
                >
                  ✓ 발송 완료로 표시
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 토스트 */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl z-50 animate-bounce">
            {toast}
          </div>
        )}

      </div>
    </div>
  );
}
