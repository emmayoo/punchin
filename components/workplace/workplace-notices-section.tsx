"use client";

import { WorkplaceSectionCard } from "@/components/workplace/workplace-section-card";

export function WorkplaceNoticesSection() {
  return (
    <WorkplaceSectionCard title="공지 사항">
      <div className="space-y-2 text-sm text-zinc-700 dark:text-neutral-300">
        <p>준비 중</p>
      </div>
    </WorkplaceSectionCard>
  );
}
