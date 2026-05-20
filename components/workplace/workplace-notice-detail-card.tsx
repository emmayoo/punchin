"use client";

import { ChevronLeft, ChevronRight, Pencil, Pin, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { canEditNotice, isNoticeAuthor } from "@/components/workplace/workplace-notice-access";
import { workApi, type NoticeInput } from "@/lib/api/work-api";
import { emitWorkplaceChanged } from "@/lib/constants/dom-event";
import { formatKoDateTimeClip } from "@/lib/date-format";
import { shouldUnoptimizeNextImage } from "@/lib/media/next-image";
import { toast } from "@/lib/toast";
import type { BranchRole, Notice } from "@/types/work";

type WorkplaceNoticeDetailCardProps = {
  notice: Notice;
  slideIndex: number;
  onSlideIndexChange: (index: number) => void;
  actorPhone: string | null;
  actorEmployeeId: string | null;
  actorRole: BranchRole | "creator" | null;
  roleByEmployeeId: ReadonlyMap<string, BranchRole>;
  onNoticeChange: (notice: Notice) => void;
};

type ToolbarVariant = "pin" | "edit" | "delete";

function toolbarTone(variant: ToolbarVariant, pinned: boolean): string {
  if (variant === "pin") {
    return pinned ? "text-amber-500" : "text-zinc-300 dark:text-neutral-600";
  }
  if (variant === "edit") {
    return "text-zinc-900 dark:text-neutral-100";
  }
  return "text-red-500 dark:text-red-400";
}

function ToolbarIconButton({
  label,
  onClick,
  href,
  variant,
  pinned = false,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  variant: ToolbarVariant;
  pinned?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const className = [
    "flex h-9 w-9 items-center justify-center transition-opacity hover:opacity-70 active:opacity-50 disabled:opacity-40",
    toolbarTone(variant, pinned),
  ].join(" ");

  if (href) {
    if (disabled) {
      return (
        <span
          aria-label={label}
          aria-disabled="true"
          className={`${className} pointer-events-none`}
        >
          {children}
        </span>
      );
    }
    return (
      <Link href={href} aria-label={label} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
}

export function WorkplaceNoticeDetailCard({
  notice,
  slideIndex,
  onSlideIndexChange,
  actorPhone,
  actorEmployeeId,
  actorRole,
  roleByEmployeeId,
  onNoticeChange,
}: WorkplaceNoticeDetailCardProps) {
  const router = useRouter();
  const [pinBusy, setPinBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const canEdit = canEditNotice(notice, actorEmployeeId, actorRole, roleByEmployeeId);
  const canPin = isNoticeAuthor(notice, actorEmployeeId);
  const showToolbar = canEdit || canPin;

  const imageCount = notice.attachments.length;
  const currentImage = imageCount > 0 ? notice.attachments[slideIndex % imageCount] : null;

  const handleTogglePin = async () => {
    if (!actorPhone || !canPin) {
      return;
    }
    const payload: NoticeInput = {
      title: notice.title,
      content: notice.content,
      isPinned: !notice.isPinned,
      attachments: notice.attachments.map((item) => item.imageUrl),
    };
    setPinBusy(true);
    try {
      const updated = await workApi.updateNotice(notice.id, payload, actorPhone);
      if (!updated) {
        toast.error("중요 공지 설정에 실패했습니다.");
        return;
      }
      onNoticeChange(updated);
      toast.success(updated.isPinned ? "중요 공지로 설정했습니다." : "일반 공지로 변경했습니다.");
      emitWorkplaceChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 중 오류가 났습니다.");
    } finally {
      setPinBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!actorPhone || !canEdit) {
      return;
    }
    if (!window.confirm("이 공지를 삭제할까요?")) {
      return;
    }
    setDeleteBusy(true);
    try {
      const ok = await workApi.deleteNotice(notice.id, actorPhone);
      if (!ok) {
        toast.error("공지 삭제에 실패했습니다. 권한을 확인해 주세요.");
        return;
      }
      toast.success("공지를 삭제했습니다.");
      emitWorkplaceChanged();
      router.push("/workplace/notices");
    } finally {
      setDeleteBusy(false);
    }
  };

  const moveSlide = (direction: "prev" | "next") => {
    if (imageCount <= 1) {
      return;
    }
    onSlideIndexChange(
      direction === "prev"
        ? (slideIndex - 1 + imageCount) % imageCount
        : (slideIndex + 1) % imageCount,
    );
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white dark:border-white/10 dark:bg-zinc-950/40">
      <header className="border-b border-zinc-100 px-4 pb-4 pt-4 dark:border-white/5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {notice.isPinned ? (
              <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                <Pin className="h-3 w-3" aria-hidden />
                중요 공지
              </span>
            ) : null}
            <h1 className="text-lg font-semibold leading-snug tracking-tight text-zinc-900 dark:text-white">
              {notice.title}
            </h1>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-neutral-500">
              <span className="font-medium text-zinc-700 dark:text-neutral-300">
                {notice.authorName}
              </span>
              <span className="mx-1.5 text-zinc-300 dark:text-neutral-600">·</span>
              {formatKoDateTimeClip(notice.createdAt)}
            </p>
          </div>

          {showToolbar ? (
            <div className="flex shrink-0 items-center gap-1" role="toolbar" aria-label="공지 관리">
              {canPin ? (
                <ToolbarIconButton
                  label={notice.isPinned ? "중요 공지 해제" : "중요 공지로 설정"}
                  variant="pin"
                  pinned={notice.isPinned}
                  onClick={() => void handleTogglePin()}
                  disabled={pinBusy}
                >
                  <Pin
                    className={`h-4 w-4 ${notice.isPinned ? "fill-current" : ""}`}
                    strokeWidth={notice.isPinned ? 2.25 : 2}
                  />
                </ToolbarIconButton>
              ) : null}
              {canEdit ? (
                <>
                  <ToolbarIconButton
                    label="공지 수정"
                    variant="edit"
                    href={`/workplace/notices/${notice.id}/edit`}
                    disabled={deleteBusy}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </ToolbarIconButton>
                  <ToolbarIconButton
                    label="공지 삭제"
                    variant="delete"
                    onClick={() => void handleDelete()}
                    disabled={deleteBusy}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </ToolbarIconButton>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800 dark:text-neutral-200">
          {notice.content}
        </p>

        {currentImage ? (
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-xl bg-zinc-100 dark:bg-neutral-900">
              <Image
                src={currentImage.imageUrl}
                alt={`첨부 이미지 ${slideIndex + 1}`}
                width={1200}
                height={720}
                sizes="(max-width: 768px) 100vw, 48rem"
                unoptimized={shouldUnoptimizeNextImage(currentImage.imageUrl)}
                className="aspect-4/3 w-full object-cover sm:aspect-video"
              />
              {imageCount > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => moveSlide("prev")}
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/65"
                    aria-label="이전 이미지"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlide("next")}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/65"
                    aria-label="다음 이미지"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : null}
            </div>
            {imageCount > 1 ? (
              <div className="flex items-center justify-center gap-1.5">
                {notice.attachments.map((_, index) => (
                  <button
                    key={`dot-${index}`}
                    type="button"
                    onClick={() => onSlideIndexChange(index)}
                    aria-label={`${index + 1}번째 이미지`}
                    className={`h-1.5 rounded-full transition-all ${
                      index === slideIndex % imageCount
                        ? "w-4 bg-zinc-800 dark:bg-white"
                        : "w-1.5 bg-zinc-300 dark:bg-neutral-600"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
