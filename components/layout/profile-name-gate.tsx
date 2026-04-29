"use client";

import { useEffect, useRef, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { FirstProfileForm } from "@/components/onboarding/first-profile-form";
import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { workApi } from "@/lib/api/work-api";
import { toast } from "@/lib/toast";

/**
 * `employees.display_name_confirmed_at` 가 NULL일 때만 표시 이름 확인 모달.
 * 패턴 매칭 없음(DB 단일 근거).
 */
export function ProfileNameGate() {
  // 게이트는 "필요할 때만" 열리고, 닫힌 이후에는 polling을 멈춰 불필요한 fetch/렌더를 줄인다.
  const { data, refresh } = useDashboardData({ pollMs: null });
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const initializedRef = useRef(false);
  const lastSessionPhoneRef = useRef<string | null>(null);

  const session = data?.session ?? null;
  const needsGate = Boolean(session && session.displayNameConfirmedAt === null);

  useEffect(() => {
    if (!needsGate) {
      initializedRef.current = false;
      lastSessionPhoneRef.current = null;
      return;
    }

    const phone = session?.phone ?? null;
    if (!phone) {
      return;
    }

    // 로그인/세션이 바뀌면 다시 초기화
    if (lastSessionPhoneRef.current !== phone) {
      initializedRef.current = false;
      lastSessionPhoneRef.current = phone;
    }

    // 사용자 입력 덮어쓰기를 막기 위해, 게이트가 열린 뒤 최초 1회만 name으로 채운다.
    if (!initializedRef.current && session?.name) {
      setNameDraft(session.name);
      initializedRef.current = true;
    }
  }, [needsGate, session?.phone, session?.name]);

  const handleSubmit = async () => {
    if (!session) {
      return;
    }
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    setBusy(true);
    const updated = await workApi.updateMyProfileName(session.phone, trimmed);
    setBusy(false);
    if (!updated) {
      toast.error("이름을 저장하지 못했습니다.");
      return;
    }
    await refresh();
    window.dispatchEvent(new Event("workplace:changed"));
    toast.success("이름을 저장했습니다.");
  };

  return (
    <FullscreenModal open={needsGate}>
      <FirstProfileForm
        phone={session?.phone ?? ""}
        name={nameDraft}
        busy={busy}
        onNameChange={setNameDraft}
        onSubmit={() => void handleSubmit()}
        heading="이름을 확인해 주세요"
        description="매장에서 등록된 이름이 있어도, 출근·스케줄에 쓸 표시 이름을 한 번 확인해 주세요."
        submitLabel="저장하고 계속하기"
      />
    </FullscreenModal>
  );
}
