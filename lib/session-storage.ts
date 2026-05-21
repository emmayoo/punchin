"use client";

const SESSION_KEY = "punchin:session";

/** Supabase 로그아웃 시 레거시 브라우저 세션 키 제거 */
export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SESSION_KEY);
}
