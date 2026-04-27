/* 자금일보 자동 전송 Service Worker */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

let scheduledTime = null;
let isEnabled     = false;
let lastSentDate  = null;
let scheduleTimer = null;

// ── 페이지 → SW 메시지 수신 ───────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type, time, enabled, lastSent } = event.data || {};

  if (type === 'SCHEDULE_UPDATE') {
    lastSentDate = lastSent || null;
    isEnabled    = !!enabled;
    scheduledTime = time || null;

    if (scheduleTimer) { clearTimeout(scheduleTimer); scheduleTimer = null; }
    if (isEnabled && scheduledTime) scheduleNextAlarm();
  }

  if (type === 'MARK_SENT') {
    lastSentDate = event.data.date;
  }
});

// ── 알람 스케줄 ──────────────────────────────────────────────────────────
function scheduleNextAlarm() {
  if (!scheduledTime) return;
  const [h, m] = scheduledTime.split(':').map(Number);

  const now    = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);

  const delay = target.getTime() - now.getTime();

  scheduleTimer = setTimeout(async () => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastSentDate === today) { scheduleNextAlarm(); return; }

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    if (clients.length > 0) {
      // 앱이 열려 있으면 → 페이지에 자동 전송 명령
      clients.forEach((c) => c.postMessage({ type: 'AUTO_SEND_NOW' }));
    } else {
      // 앱이 닫혀 있으면 → 알림 표시
      self.registration.showNotification('📅 자금일보 전송 시간입니다', {
        body: '카카오톡으로 오늘의 자금 현황을 자동 전송합니다. 탭하여 실행하세요.',
        icon: '/favicon.ico',
        tag:  'cashflow-alarm',
        requireInteraction: true,
        data: { url: '/cashflow?autoSend=1' },
      });
    }
    scheduleNextAlarm(); // 내일 다시 예약
  }, delay);
}

// ── 알림 클릭 → 앱 열기 ─────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/cashflow?autoSend=1';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
