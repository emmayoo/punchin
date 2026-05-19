"use client";

import { Pin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { WorkplaceSectionCard } from "@/components/workplace/workplace-section-card";
import { WorkplaceSectionLink } from "@/components/workplace/workplace-section-link";
import { workApi } from "@/lib/api/work-api";
import { formatKoDateTimeFull } from "@/lib/date-format";
import { startOfWeek } from "@/lib/time";
import type { Notice } from "@/types/work";

type WorkplaceNoticesSectionProps = {
  branchId: string | null;
};
export function WorkplaceNoticesSection({ branchId }: WorkplaceNoticesSectionProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!branchId) {
        if (!mounted) {
          return;
        }
        setNotices([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const rows = await workApi.listNotices(branchId);
      if (!mounted) {
        return;
      }
      setNotices(rows);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [branchId]);

  const visibleNotices = useMemo(() => {
    const weekStart = startOfWeek(new Date()).getTime();
    const pinned = notices.filter((notice) => notice.isPinned);
    const weekly = notices.filter(
      (notice) => !notice.isPinned && new Date(notice.createdAt).getTime() >= weekStart,
    );
    return [...pinned, ...weekly]
      .sort(
        (a, b) =>
          Number(b.isPinned) - Number(a.isPinned) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 4);
  }, [notices]);

  return (
    <WorkplaceSectionCard
      title="공지 사항"
      action={<WorkplaceSectionLink href="/workplace/notices" label="공지 전체 보기" />}
    >
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">공지를 불러오는 중...</p>
        ) : visibleNotices.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">공지가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {visibleNotices.map((notice) => {
              return (
                <Link key={notice.id} href={`/workplace/notices/${notice.id}`} className="block">
                  <article className="rounded-xl border border-zinc-200/80 bg-zinc-50/90 p-3 transition-colors hover:bg-zinc-100/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                          {notice.isPinned ? (
                            <span className="mr-1 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <Pin className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                          {notice.title}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-neutral-500">
                          {notice.authorName} · {formatKoDateTimeFull(notice.createdAt)}
                        </p>
                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap wrap-break-word text-sm text-zinc-800 dark:text-neutral-200">
                          {notice.content}
                        </p>
                      </div>
                      {notice.attachments[0] ? (
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-200/80 dark:border-white/10">
                          <Image
                            src={notice.attachments[0].imageUrl}
                            alt="공지 썸네일"
                            width={56}
                            height={56}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                          {notice.attachments.length > 1 ? (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[11px] font-semibold text-white">
                              +{notice.attachments.length - 1}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </WorkplaceSectionCard>
  );
}
