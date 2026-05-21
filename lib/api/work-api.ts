"use client";

import { SupabaseWorkApi } from "@/lib/api/supabase-work-api";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type {
  BranchSetupInput,
  DashboardData,
  NoticeInput,
  RangeWorkDetail,
  RangeWorkStatRow,
  SchedulePersonRecord,
  WeeklyStatRow,
} from "@/lib/api/work-api-types";

let workApiInstance: SupabaseWorkApi | undefined;

export function getWorkApi(): SupabaseWorkApi {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 확인하세요.",
    );
  }
  workApiInstance ??= new SupabaseWorkApi();
  return workApiInstance;
}

export const workApi = new Proxy({} as SupabaseWorkApi, {
  get(_target, prop) {
    const api = getWorkApi();
    const value = api[prop as keyof SupabaseWorkApi];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(api);
    }
    return value;
  },
});
