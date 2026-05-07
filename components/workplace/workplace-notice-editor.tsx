"use client";

import { ImagePlus, Pin } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { type NoticeInput, workApi } from "@/lib/api/work-api";
import { emitWorkplaceChanged } from "@/lib/constants/dom-event";
import { toast } from "@/lib/toast";
import type { BranchRole, Notice } from "@/types/work";

type WorkplaceNoticeEditorProps = {
  mode: "create" | "edit";
  noticeId?: string;
  branchId: string | null;
  actorPhone: string | null;
  actorEmployeeId: string | null;
  actorRole: BranchRole | "creator" | null;
};

function canEditNotice(
  notice: Notice,
  actorEmployeeId: string | null,
  actorRole: BranchRole | "creator" | null,
  roleByEmployeeId: ReadonlyMap<string, BranchRole>,
): boolean {
  if (!actorEmployeeId) {
    return false;
  }
  if (notice.authorEmployeeId === actorEmployeeId) {
    return true;
  }
  const authorRole = roleByEmployeeId.get(notice.authorEmployeeId) ?? null;
  if (actorRole === "creator" || actorRole === "owner") {
    return authorRole === "manager" || authorRole === "staff" || authorRole === null;
  }
  if (actorRole === "manager") {
    return authorRole === "staff" || authorRole === null;
  }
  return false;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function WorkplaceNoticeEditor({
  mode,
  noticeId,
  branchId,
  actorPhone,
  actorEmployeeId,
  actorRole,
}: WorkplaceNoticeEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [targetNotice, setTargetNotice] = useState<Notice | null>(null);
  const [canEditTarget, setCanEditTarget] = useState(mode === "create");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (mode !== "edit" || !noticeId || !branchId || !actorPhone) {
        if (!mounted) {
          return;
        }
        setLoading(false);
        return;
      }
      setLoading(true);
      const [notices, members] = await Promise.all([
        workApi.listNotices(branchId),
        workApi.listBranchMembers(branchId, actorPhone),
      ]);
      if (!mounted) {
        return;
      }
      const found = notices.find((notice) => notice.id === noticeId) ?? null;
      if (!found) {
        setTargetNotice(null);
        setCanEditTarget(false);
        setLoading(false);
        return;
      }
      const roleByEmployeeId = new Map(members.map((member) => [member.employeeId, member.role] as const));
      const allowed = canEditNotice(found, actorEmployeeId, actorRole, roleByEmployeeId);
      setTargetNotice(found);
      setCanEditTarget(allowed);
      if (allowed) {
        setTitle(found.title);
        setContent(found.content);
        setIsPinned(found.isPinned);
        setAttachments(found.attachments.map((item) => item.imageUrl));
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [actorEmployeeId, actorPhone, actorRole, branchId, mode, noticeId]);

  const canSubmit = useMemo(() => {
    if (!branchId || !actorPhone) {
      return false;
    }
    if (mode === "edit") {
      return canEditTarget;
    }
    return true;
  }, [actorPhone, branchId, canEditTarget, mode]);

  const handlePickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    const validFiles = [...files].slice(0, 10);
    try {
      const urls = await Promise.all(validFiles.map(readAsDataUrl));
      setAttachments((prev) => [...prev, ...urls].slice(0, 10));
    } catch {
      toast.error("이미지를 읽지 못했습니다.");
    }
  };

  const handleSave = async () => {
    if (!canSubmit || !branchId || !actorPhone) {
      return;
    }
    const payload: NoticeInput = {
      title: title.trim(),
      content: content.trim(),
      isPinned,
      attachments,
    };
    if (!payload.title || !payload.content) {
      toast.error("제목과 콘텐츠를 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const saved =
        mode === "create"
          ? await workApi.createNotice(branchId, payload, actorPhone)
          : await workApi.updateNotice(String(noticeId), payload, actorPhone);
      if (!saved) {
        toast.error("공지 저장에 실패했습니다. 권한을 확인해 주세요.");
        return;
      }
      toast.success(mode === "create" ? "공지를 등록했습니다." : "공지를 수정했습니다.");
      emitWorkplaceChanged();
      router.push("/workplace/notices");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!noticeId || !actorPhone || !canEditTarget) {
      return;
    }
    setDeleting(true);
    try {
      const ok = await workApi.deleteNotice(noticeId, actorPhone);
      if (!ok) {
        toast.error("공지 삭제에 실패했습니다. 권한을 확인해 주세요.");
        return;
      }
      toast.success("공지를 삭제했습니다.");
      emitWorkplaceChanged();
      router.push("/workplace/notices");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-neutral-400">불러오는 중...</p>;
  }
  if (mode === "edit" && !targetNotice) {
    return <p className="text-sm text-zinc-600 dark:text-neutral-400">공지를 찾지 못했습니다.</p>;
  }
  if (mode === "edit" && !canEditTarget) {
    return <p className="text-sm text-zinc-600 dark:text-neutral-400">수정 권한이 없습니다.</p>;
  }

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700 dark:text-neutral-300">공지 설정</p>
          <button
            type="button"
            onClick={() => setIsPinned((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
              isPinned
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
                : "border-zinc-200 bg-white text-zinc-600 dark:border-white/20 dark:bg-white/5 dark:text-neutral-300"
            }`}
          >
            <Pin className="h-3.5 w-3.5" />
            {isPinned ? "중요 공지" : "일반 공지"}
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="w-full rounded-lg border border-zinc-200/90 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/15 dark:bg-neutral-900"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="콘텐츠"
          rows={8}
          className="w-full resize-y rounded-lg border border-zinc-200/90 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/15 dark:bg-neutral-900"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500 dark:text-neutral-400">
            이미지 첨부 {attachments.length}/10
          </p>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/20 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10">
            <ImagePlus className="h-3.5 w-3.5" />
            이미지 첨부
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                void handlePickFiles(e.target.files);
                e.currentTarget.value = "";
              }}
              className="sr-only"
            />
          </label>
        </div>
        {attachments.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto">
            {attachments.map((url, idx) => (
              <div key={`${url}-${idx}`} className="relative shrink-0">
                <Image
                  src={url}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, index) => index !== idx))}
                  className="absolute -right-1 -top-1 rounded-full bg-black/70 px-1 text-[10px] text-white"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex justify-between">
          {mode === "edit" ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting || saving}
              className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-60 dark:border-red-700/50 dark:text-red-300"
            >
              {deleting ? "삭제 중..." : "삭제"}
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/workplace/notices")}
              className="rounded-md border border-zinc-200/90 px-3 py-2 text-sm text-zinc-700 dark:border-white/20 dark:text-neutral-300"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || deleting || !canSubmit}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
            >
              {saving ? "저장 중..." : mode === "create" ? "등록" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
