"use client";

import { LocalWorkApi } from "@/lib/api/local-work-api";
import { SupabaseWorkApi } from "@/lib/api/supabase-work-api";

export type {
  BranchSetupInput,
  DashboardData,
  NoticeInput,
  RangeWorkDetail,
  RangeWorkStatRow,
  SchedulePersonRecord,
  WeeklyStatRow,
} from "@/lib/api/work-api-types";

const hasSupabaseEnv =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

/** UI에서 업로드 플로우 분기용 (예: 공지 첨부 Storage 업로드). */
export const isSupabaseBackend = hasSupabaseEnv;

export const workApi = hasSupabaseEnv ? new SupabaseWorkApi() : new LocalWorkApi();
