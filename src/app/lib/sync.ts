/**
 * Supabase 클라우드 동기화
 * - pushToCloud(collection, data): localStorage 저장 후 백그라운드로 클라우드에 올림
 * - pullFromCloud(): 클라우드에서 전체 데이터를 내려받아 localStorage 갱신
 */

import { supabase } from "./supabase";
import { getGymCode } from "./gymCode";

// collection → localStorage 키 매핑
const KEY_MAP: Record<string, string> = {
  members:     "gym_members",
  trainers:    "gym_trainers",
  costs:       "gym_costs",
  schedules:   "gym_schedule",
  settlements: "gym_settlements",
};

export type SyncCollection = keyof typeof KEY_MAP;

/** 단일 컬렉션을 클라우드에 upsert (비동기, 오류는 콘솔만 출력) */
export async function pushToCloud(
  collection: SyncCollection,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
): Promise<void> {
  if (!supabase) return;
  const gym_code = getGymCode();
  if (!gym_code) return;

  try {
    const { error } = await supabase
      .from("gym_data")
      .upsert(
        { gym_code, collection, data, updated_at: new Date().toISOString() },
        { onConflict: "gym_code,collection" }
      );
    if (error) console.warn("[sync] push error", collection, error.message);
  } catch (e) {
    console.warn("[sync] push exception", collection, e);
  }
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
      return { ok: false, message: "클라우드에 데이터가 없습니다. 먼저 PC에서 저장해 주세요." };

    rows.forEach(({ collection, data }) => {
      const lsKey = KEY_MAP[collection];
      if (lsKey && data) {
        localStorage.setItem(lsKey, JSON.stringify(data));
      }
    });

    return { ok: true, message: `${rows.length}개 컬렉션을 성공적으로 받았습니다. 페이지를 새로고침하면 반영됩니다.` };
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
      let data = [];
      try { data = JSON.parse(localStorage.getItem(lsKey) || "[]"); } catch { /* empty */ }
      return { gym_code, collection, data, updated_at: new Date().toISOString() };
    });

    const { error } = await supabase
      .from("gym_data")
      .upsert(upserts, { onConflict: "gym_code,collection" });

    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "모든 데이터를 클라우드에 업로드했습니다." };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}
