const GYM_CODE_KEY = "gym_sync_code";

export function getGymCode(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GYM_CODE_KEY) ?? "";
}

export function setGymCode(code: string) {
  localStorage.setItem(GYM_CODE_KEY, code.trim());
}

export function clearGymCode() {
  localStorage.removeItem(GYM_CODE_KEY);
}
