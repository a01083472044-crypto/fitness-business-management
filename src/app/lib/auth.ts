import { supabase } from "./supabase";
import type { BusinessType } from "./store";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  branch: string;   // "" = 전체 접근 (superadmin)
  role: "platform_admin" | "superadmin" | "branch" | "pending";
  gym_code: string;
  business_type?: BusinessType;
  created_at?: string;
}

export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase가 설정되지 않았습니다." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return {};
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function createUser(
  email: string,
  password: string,
  full_name: string,
  branch: string,
  role: "superadmin" | "branch",
  gym_code: string
): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase가 설정되지 않았습니다." };

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) return { error: error?.message ?? "계정 생성 실패" };

  const { error: profileError } = await supabase.from("user_profiles").insert({
    id: data.user.id,
    email,
    full_name,
    branch,
    role,
    gym_code,
  });

  if (profileError) return { error: profileError.message };
  return {};
}
