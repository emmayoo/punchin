"use client";

import { ChevronLeft, ChevronRight, Pin, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { canEditNotice } from "@/components/workplace/workplace-notice-access";
import { workApi } from "@/lib/api/work-api";
import { formatKoDateTimeFull } from "@/lib/date-format";
import type { BranchRole, Notice } from "@/types/work";

type WorkplaceNoticesBoardProps = {
  branchId: string | null;
  actorPhone: string | null;
  actorEmployeeId: string | null;
  actorRole: BranchRole | "creator" | null;
};

export function WorkplaceNoticesBoard({
  branchId,
  actorPhone,
  actorEmployeeId,
  actorRole,
}: WorkplaceNoticesBoardProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [roleByEmployeeId, setRoleByEmployeeId] = useState<Map<string, BranchRole>>(new Map());
  const [slideIndexByNoticeId, setSlideIndexByNoticeId] = useState<Record<string, number>>({});
  const touchStartXByNoticeId = useRef<Record<string, number>>({});

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

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!branchId || !actorPhone) {
        if (!mounted) {
          return;
        }
        setRoleByEmployeeId(new Map());
        return;
      }
      const members = await workApi.listBranchMembers(branchId, actorPhone);
      if (!mounted) {
        return;
      }
      setRoleByEmployeeId(
        new Map(members.map((member) => [member.employeeId, member.role] as const)),
      );
    })();
    return () => {
      mounted = false;
    };
  }, [actorPhone, branchId]);

  const noticesSorted = useMemo(
    () =>
      [...notices].sort(
        (a, b) =>
          Number(b.isPinned) - Number(a.isPinned) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [notices],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Link
          href="/workplace/notices/new"
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 dark:border-white/20 dark:bg-white/5 dark:text-neutral-200"
        >
          <Plus className="h-3.5 w-3.5" />
          공지 등록
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-neutral-400">공지를 불러오는 중...</p>
      ) : noticesSorted.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-neutral-400">등록된 공지가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {noticesSorted.map((notice) => {
            const canEdit = canEditNotice(notice, actorEmployeeId, actorRole, roleByEmployeeId);
            const imageCount = notice.attachments.length;
            const slideIndex = slideIndexByNoticeId[notice.id] ?? 0;
            const currentImage =
              imageCount > 0 ? notice.attachments[slideIndex % imageCount] : null;
            const moveSlide = (direction: "prev" | "next") => {
              if (imageCount <= 1) {
                return;
              }
              setSlideIndexByNoticeId((prev) => ({
                ...prev,
                [notice.id]:
                  direction === "prev"
                    ? (slideIndex - 1 + imageCount) % imageCount
                    : (slideIndex + 1) % imageCount,
              }));
            };
            return (
              <article
                key={notice.id}
                className="rounded-xl border border-zinc-200/80 bg-zinc-50/90 p-3 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
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
                  </div>
                  {canEdit ? (
                    <div>
                      <Link
                        href={`/workplace/notices/${notice.id}/edit`}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 dark:border-white/20 dark:text-neutral-300"
                      >
                        수정
                      </Link>
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm text-zinc-800 dark:text-neutral-200">
                  {notice.content}
                </p>
                {currentImage ? (
                  <div className="mt-2">
                    <div
                      className="relative overflow-hidden rounded-lg border border-zinc-200/80 dark:border-white/10"
                      onTouchStart={(event) => {
                        touchStartXByNoticeId.current[notice.id] = event.touches[0]?.clientX ?? 0;
                      }}
                      onTouchEnd={(event) => {
                        const startX = touchStartXByNoticeId.current[notice.id] ?? 0;
                        const endX = event.changedTouches[0]?.clientX ?? startX;
                        const deltaX = endX - startX;
                        const SWIPE_THRESHOLD = 28;
                        if (deltaX >= SWIPE_THRESHOLD) {
                          moveSlide("prev");
                        } else if (deltaX <= -SWIPE_THRESHOLD) {
                          moveSlide("next");
                        }
                      }}
                    >
                      <Image
                        src={currentImage.imageUrl}
                        alt={`첨부 이미지 ${slideIndex + 1}`}
                        width={1200}
                        height={720}
                        unoptimized
                        className="h-44 w-full object-cover"
                      />
                      {imageCount > 1 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => moveSlide("prev")}
                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1 text-white"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSlide("next")}
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
