/**
 * Supabase 클라우드 동기화
 * - scheduleCloudPush(): 1.5초 디바운스 자동저장 (store.ts에서 호출)
 * - pushAllToCloud(): 전체 수동 백업
 * - pullFromCloud(): 클라우드 → localStorage 복원
 */

import { supabase } from "./supabase";
import { getGymCode } from "./gymCode";

// ── collection → localStorage 키 매핑 ──────────────────────────────────────
const KEY_MAP: Record<string, string> = {
  members:       "gym_members",
  trainers:      "gym_trainers",
  costs:         "gym_costs",
  schedules:     "gym_schedule",
  settlements:   "gym_settlements",
  receivables:   "gym_receivables",
  taxInvoices:   "gym_tax_invoices",
  branches:      "gym_branches",
  consultations: "gym_consultations",
  checkIns:      "gym_checkins",
  lockers:       "gym_lockers",
};

export type SyncCollection = keyof typeof KEY_MAP;

// ── 동기화 상태 이벤트 (SyncBadge 컴포넌트가 구독) ────────────────────────
export type SyncState = "idle" | "saving" | "saved" | "error";

function dispatchSyncEvent(state: SyncState, time?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("gym-sync", { detail: { state, time } }));
}

// ── 디바운스 푸시 큐 ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pendingQueue = new Map<string, any[]>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushQueue() {
  if (!supabase) return;
  const gym_code = getGymCode();
  if (!gym_code || pendingQueue.size === 0) return;

  const entries = Array.from(pendingQueue.entries());
  pendingQueue.clear();
  pushTimer = null;

  try {
    const upserts = entries.map(([collection, data]) => ({
      gym_code,
      collection,
      data,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("gym_data")
      .upsert(upserts, { onConflict: "gym_code,collection" });

    if (error) {
      console.warn("[sync] flush error", error.message);
      dispatchSyncEvent("error");
    } else {
      const t = new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      dispatchSyncEvent("saved", t);
    }
  } catch (e) {
    console.warn("[sync] flush exception", e);
    dispatchSyncEvent("error");
  }
}

/**
 * 디바운스(1.5초) 자동저장 — store.ts의 saveXxx()에서 호출
 * Supabase 미설정 or gymCode 없으면 무시 (로컬만 저장)
 */
export function scheduleCloudPush(
  collection: SyncCollection,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
): void {
  if (!supabase || !getGymCode()) return;

  pendingQueue.set(collection, data);
  dispatchSyncEvent("saving");

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(flushQueue, 1500);
}

/** 즉시 단일 컬렉션 push (하위 호환용, 내부적으로 scheduleCloudPush 호출) */
export async function pushToCloud(
  collection: SyncCollection,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
): Promise<void> {
  scheduleCloudPush(collection, data);
}

/** 전체 컬렉션을 클라우드에서 내려받아 localStorage 갱신 */
export async function pullFromCloud(): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase가 설정되지 않았습니다." };
  const gym_code = getGymCode();
  if (!gym_code) return { ok: false, message: "헬스장 코드가 없습니다." };

  try {
    const { data: rows, error } = await supabase
      .from("gym_data")
      .select("collection, data")
      .eq("gym_code", gym_code);

    if (error) return { ok: false, message: error.message };
    if (!rows || rows.length === 0)
      return {
        ok: false,
        message: "클라우드에 데이터가 없습니다. 먼저 PC에서 저장해 주세요.",
      };

    rows.forEach(({ collection, data }) => {
      const lsKey = KEY_MAP[collection];
      if (lsKey && data) {
        localStorage.setItem(lsKey, JSON.stringify(data));
      }
    });

    return {
      ok: true,
      message: `${rows.length}개 컬렉션을 성공적으로 받았습니다. 페이지를 새로고침하면 반영됩니다.`,
    };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/** 전체 컬렉션을 localStorage → 클라우드로 올림 (수동 백업용) */
export async function pushAllToCloud(): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase가 설정되지 않았습니다." };
  const gym_code = getGymCode();
  if (!gym_code) return { ok: false, message: "헬스장 코드가 없습니다." };

  try {
    const upserts = Object.entries(KEY_MAP).map(([collection, lsKey]) => {
      let data: unknown[] = [];
      try {
        data = JSON.parse(localStorage.getItem(lsKey) || "[]");
      } catch { /* empty */ }
      return { gym_code, collection, data, updated_at: new Date().toISOString() };
    });

    const { error } = await supabase
      .from("gym_data")
      .upsert(upserts, { onConflict: "gym_code,collection" });

    if (error) return { ok: false, message: error.message };
    return { ok: true, message: `${upserts.length}개 컬렉션을 클라우드에 업로드했습니다.` };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}
