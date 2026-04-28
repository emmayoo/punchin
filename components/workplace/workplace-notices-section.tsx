"use client";

import { WorkplaceSectionCard } from "@/components/workplace/workplace-section-card";

type WorkplaceNoticesSectionProps = {
  branchName: string;
};

export function WorkplaceNoticesSection({
  branchName,
}: WorkplaceNoticesSectionProps) {
  return (
    <WorkplaceSectionCard title="공지 사항">
      <div className="space-y-2 text-sm text-zinc-700 dark:text-neutral-300">
        <p>{branchName} 지점 공지 기능은 준비 중입니다.</p>
        <p className="text-zinc-500 dark:text-neutral-400">
          추후 공지 등록, 고정 공지, 직원별 확인 상태를 추가할 수 있습니다.
        </p>
      </div>
    </WorkplaceSectionCard>
  );
}
