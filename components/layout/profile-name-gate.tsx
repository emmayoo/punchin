"use client";

import { useEffect, useState } from "react";

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
  const { data, refresh } = useDashboardData({ pollMs: 120 * 1000 });
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const session = data?.session ?? null;
  const needsGate = Boolean(session && session.displayNameConfirmedAt === null);

  useEffect(() => {
    if (session?.name) {
      setNameDraft(session.name);
    }
  }, [session?.phone, session?.name]);

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
