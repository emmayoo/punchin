"use client";

import { ChevronLeft, ChevronRight, Pin } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { DetailPageShell } from "@/components/layout/detail-page-shell";
import { workApi } from "@/lib/api/work-api";
import { formatKoDateTimeFull } from "@/lib/date-format";
import type { Notice } from "@/types/work";

export default function WorkplaceNoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, loading } = useDashboardData({ pollMs: null });
  const [slideIndex, setSlideIndex] = useState(0);
  const [noticeData, setNoticeData] = useState<Notice | null>(null);
  const [loadingNotice, setLoadingNotice] = useState(true);

  const currentBranchId = useMemo(
    () => data?.session?.currentBranchId ?? data?.myBranches[0]?.id ?? null,
    [data],
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!currentBranchId || !data) {
        if (!mounted) {
          return;
        }
        setNoticeData(null);
        setLoadingNotice(false);
        return;
      }
      setLoadingNotice(true);
      const notices = await workApi.listNotices(currentBranchId);
      if (!mounted) {
        return;
      }
      const found = notices.find((n) => n.id === params.id) ?? null;
      setNoticeData(found);
      setSlideIndex(0);
      setLoadingNotice(false);
    })();
    return () => {
      mounted = false;
    };
  }, [currentBranchId, data, params.id]);

  const imageCount = noticeData?.attachments.length ?? 0;
  const currentImage = imageCount > 0 ? noticeData?.attachments[slideIndex % imageCount] : null;

  return (
    <DetailPageShell
      backHref="/workplace/notices"
      title="공지 상세"
      loading={loading || !data || loadingNotice}
    >
      {() =>
        noticeData ? (
          <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-base font-semibold text-zinc-900 dark:text-white">
              {noticeData.isPinned ? (
                <span className="mr-1 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Pin className="h-4 w-4" />
                  중요
                </span>
              ) : null}
              {noticeData.title}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-neutral-500">
              {noticeData.authorName} · {formatKoDateTimeFull(noticeData.createdAt)}
            </p>
            <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm text-zinc-800 dark:text-neutral-200">
              {noticeData.content}
            </p>
            {currentImage ? (
              <div className="mt-3">
                <div className="relative overflow-hidden rounded-lg border border-zinc-200/80 dark:border-white/10">
                  <Image
                    src={currentImage.imageUrl}
                    alt={`첨부 이미지 ${slideIndex + 1}`}
                    width={1200}
                    height={720}
                    unoptimized
                    className="h-64 w-full object-cover"
                  />
                  {imageCount > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSlideIndex((prev) => (prev - 1 + imageCount) % imageCount)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1 text-white"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlideIndex((prev) => (prev + 1) % imageCount)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1 text-white"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <span className="absolute bottom-2 right-2 rounded bg-black/55 px-2 py-0.5 text-xs text-white">
                        {slideIndex + 1}/{imageCount}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">공지를 찾지 못했습니다.</p>
        )
      }
    </DetailPageShell>
  );
}
