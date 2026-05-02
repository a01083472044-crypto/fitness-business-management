import { supabase } from "./supabase";

export interface Subscription {
  id: string;
  user_id: string;
  plan: "starter" | "pro" | "enterprise";
  status: "trial" | "active" | "past_due" | "cancelled";
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}

/**
 * 현재 로그인 사용자의 구독 정보 조회
 */
export async function getSubscription(userId: string): Promise<Subscription | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as Subscription;
}

/**
 * 구독이 활성화 상태인지 확인 (trial 포함)
 */
export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub) return false;

  if (sub.status === "trial") {
    if (!sub.trial_ends_at) return true;
    return new Date(sub.trial_ends_at) > new Date();
  }

  if (sub.status === "active") return true;

  return false;
}

/**
 * 남은 체험 일수
 */
export function trialDaysLeft(sub: Subscription | null): number {
  if (!sub || sub.status !== "trial" || !sub.trial_ends_at) return 0;
  const diff = new Date(sub.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export const PLAN_NAMES: Record<string, string> = {
  starter: "스타터",
  pro:     "프로",
  enterprise: "엔터프라이즈",
};

export const PLAN_PRICES: Record<string, number> = {
  starter: 29000,
  pro:     59000,
};
