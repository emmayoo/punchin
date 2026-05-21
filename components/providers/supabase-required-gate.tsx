"use client";

import { isSupabaseConfigured } from "@/lib/supabase/config";

type SupabaseRequiredGateProps = {
  children: React.ReactNode;
};

export function SupabaseRequiredGate({ children }: SupabaseRequiredGateProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">Supabase 연결이 필요합니다</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> 환경 변수를
          설정한 뒤 개발 서버를 다시 실행해 주세요.
        </p>
      </div>
    );
  }

  return children;
}
