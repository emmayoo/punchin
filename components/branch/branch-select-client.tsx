"use client";

import { FullscreenModal } from "@/components/overlay/fullscreen-modal";
import { workApi } from "@/lib/api/work-api";
import { toast } from "@/lib/toast";
import type { Branch, BranchMembership, Employee } from "@/types/work";
import {
  Check,
  Link2,
  Pencil,
  Star,
  Trash2,
  Unlink2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type EditingBranch = {
  id: string;
  name: string;
};

export function BranchSelectClient() {
  const router = useRouter();
  const [session, setSession] = useState<Employee | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [memberships, setMemberships] = useState<BranchMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [editing, setEditing] = useState<EditingBranch | null>(null);

  const refresh = useCallback(async () => {
    const dashboard = await workApi.getDashboard();
    if (!dashboard.session) {
      router.replace("/auth");
      return;
    }
    setSession(dashboard.session);
    const [all, myMemberships] = await Promise.all([
      workApi.getBranches(),
      workApi.getMyBranchMemberships(dashboard.session.phone),
    ]);
    setBranches(all);
    setMemberships(myMemberships);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await workApi.init();
      if (!mounted) {
        return;
      }
      await refresh();
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  const handleSetDefault = async (branchId: string) => {
    if (!session) {
      return;
    }
    setBusy(true);
    await workApi.completeBranchSetup(session.phone, {
      mode: "select",
      branchId,
    });
    await refresh();
    setBusy(false);
    toast.success("기본 지점을 설정했습니다.");
  };

  const handleConnect = async (branchId: string) => {
    if (!session) {
      return;
    }
    setBusy(true);
    const ok = await workApi.connectBranch(session.phone, branchId);
    setBusy(false);
    if (!ok) {
      toast.error("지점 연결에 실패했습니다.");
      return;
    }
    await refresh();
    toast.success("지점을 연결했습니다.");
  };

  const handleDisconnect = async (branchId: string) => {
    if (!session) {
      return;
    }
    const myMemberships = memberships.filter(
      (item) => item.employeePhone === session.phone,
    );
    const isDefault = session.currentBranchId === branchId;
    if (isDefault && myMemberships.length <= 1) {
      toast.error("최소 1개 지점은 연결되어 있어야 합니다.");
      return;
    }
    setBusy(true);
    const ok = await workApi.disconnectBranch(session.phone, branchId);
    setBusy(false);
    if (!ok) {
      toast.error("지점 선택 해제에 실패했습니다.");
      return;
    }
    await refresh();
    toast.success("지점 선택을 해제했습니다.");
  };

  const handleCreate = async () => {
    if (!session) {
      return;
    }
    const trimmed = newBranchName.trim();
    if (!trimmed) {
      toast.error("지점 이름을 입력해주세요.");
      return;
    }
    setBusy(true);
    await workApi.completeBranchSetup(session.phone, {
      mode: "create",
      branchName: trimmed,
    });
    await refresh();
    setBusy(false);
    toast.success("새 지점을 만들고 기본 지점으로 설정했습니다.");
  };

  const handleUpdate = async () => {
    if (!session || !editing) {
      return;
    }
    const trimmed = editing.name.trim();
    if (!trimmed) {
      toast.error("지점 이름을 입력해주세요.");
      return;
    }
    setBusy(true);
    const updated = await workApi.updateMyCreatedBranch(
      editing.id,
      session.phone,
      trimmed,
    );
    setBusy(false);
    if (!updated) {
      toast.error("내가 만든 지점만 수정할 수 있어요.");
      return;
    }
    toast.success("지점 이름을 수정했습니다.");
    setEditing(null);
    await refresh();
  };

  const handleDelete = async (branchId: string) => {
    if (!session) {
      return;
    }
    setBusy(true);
    const ok = await workApi.deleteMyCreatedBranch(branchId, session.phone);
    setBusy(false);
    if (!ok) {
      toast.error("내가 만든 지점만 삭제할 수 있어요.");
      return;
    }
    toast.success("지점을 삭제했습니다.");
    await refresh();
  };

  if (loading) {
    return <p className="p-4 text-sm text-neutral-400">불러오는 중...</p>;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          지점 선택
        </h1>
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white px-3 py-1 text-xs text-zinc-700 dark:border-white/10 dark:bg-[#18181b] dark:text-neutral-300">
          <span>연결</span>
          <span className="font-semibold">{memberships.length}개</span>
          <span>·</span>
          <span className="font-semibold">
            {session?.currentBranchId ? "기본 설정됨" : "기본 미설정"}
          </span>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-[#111113]">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-white">
          지점 목록
        </h2>
        {branches.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">
            아직 생성된 지점이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {branches.map((branch) => {
              const membership =
                memberships.find((item) => item.branchId === branch.id) ?? null;
              const isMember = membership !== null;
              const isDefault = session?.currentBranchId === branch.id;
              const isMine = branch.createdByPhone === session?.phone;
              return (
                <li
                  key={branch.id}
                  className="rounded-xl border border-zinc-200/90 bg-white p-3 dark:border-white/10 dark:bg-[#18181b]"
                >
                  <div className="space-y-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                        {branch.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-neutral-500">
                        <span className="whitespace-nowrap">
                          {isMine ? "내가 만든 지점" : "참여 가능 지점"}
                        </span>
                        <span>·</span>
                        <span className="whitespace-nowrap">
                          {isMember ? "연결됨" : "미연결"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isMember ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-white/10 dark:text-neutral-300 whitespace-nowrap">
                          {membership.role}
                        </span>
                      ) : null}
                      {isDefault ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 whitespace-nowrap">
                          default
                        </span>
                      ) : null}
                      {!isMember ? (
                        <button
                          type="button"
                          onClick={() => handleConnect(branch.id)}
                          disabled={busy}
                          title="지점 연결"
                          aria-label="지점 연결"
                          className="rounded-lg border border-zinc-300/90 p-2 text-zinc-900 dark:border-white/20 dark:text-white"
                        >
                          <Link2 className="h-4 w-4" />
                        </button>
                      ) : !isDefault ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(branch.id)}
                          disabled={busy}
                          title="기본 지점으로 설정"
                          aria-label="기본 지점으로 설정"
                          className="rounded-lg border border-zinc-300/90 p-2 text-zinc-900 dark:border-white/20 dark:text-white"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      ) : null}
                      {isMember ? (
                        <button
                          type="button"
                          onClick={() => handleDisconnect(branch.id)}
                          disabled={busy}
                          title="선택 해제"
                          aria-label="선택 해제"
                          className="rounded-lg border border-zinc-300/90 p-2 text-zinc-700 dark:border-white/20 dark:text-neutral-200"
                        >
                          <Unlink2 className="h-4 w-4" />
                        </button>
                      ) : null}
                      {isMine ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({ id: branch.id, name: branch.name })
                            }
                            disabled={busy}
                            title="지점 이름 수정"
                            aria-label="지점 이름 수정"
                            className="rounded-lg border border-zinc-300/90 p-2 text-zinc-900 dark:border-white/20 dark:text-white"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(branch.id)}
                            disabled={busy}
                            title="지점 삭제"
                            aria-label="지점 삭제"
                            className="rounded-lg border border-rose-400/60 p-2 text-rose-700 dark:text-rose-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-[#111113]">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-white">새 지점</h2>
        <input
          value={newBranchName}
          onChange={(event) => setNewBranchName(event.target.value)}
          placeholder="예: 강남점"
          className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-[#18181b] dark:text-neutral-100 dark:focus:border-white/35"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy}
          className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
        >
          {busy ? "처리 중..." : "생성"}
        </button>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="w-full rounded-xl border border-zinc-300/90 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-400 dark:border-white/20 dark:text-white dark:hover:border-white/40"
        >
          <span className="inline-flex items-center gap-1">
            <Check className="h-4 w-4" />
            완료
          </span>
        </button>
      </section>

      <FullscreenModal open={editing !== null}>
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
            지점 이름 수정
          </h2>
          <input
            value={editing?.name ?? ""}
            onChange={(event) =>
              setEditing((prev) =>
                prev ? { ...prev, name: event.target.value } : prev,
              )
            }
            className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-zinc-200/90 px-3 py-2 text-sm text-zinc-800 dark:border-white/20 dark:text-neutral-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={busy}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
            >
              저장
            </button>
          </div>
        </div>
      </FullscreenModal>
    </main>
  );
}
