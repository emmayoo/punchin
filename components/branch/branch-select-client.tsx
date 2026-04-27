"use client";

import {
  BranchCreateModal,
  type BranchCreateForm,
} from "@/components/branch/branch-create-modal";
import { BranchList } from "@/components/branch/branch-list";
import { BranchSelectedTags } from "@/components/branch/branch-selected-tags";
import { workApi } from "@/lib/api/work-api";
import { toast } from "@/lib/toast";
import type { Branch, BranchMembership, Employee } from "@/types/work";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function sanitizeBusinessNumber(value: string): string {
  return value.replace(/[^0-9-]/g, "");
}

function isValidBusinessNumber(value: string): boolean {
  return /^[0-9-]+$/.test(value);
}

/** 선택 집합에서 기본 지점: owner 우선, 없으면 목록 순 첫 지점. */
function pickDefaultBranchId(
  finalIdSet: Set<string>,
  branchList: Branch[],
  sessionPhone: string,
): string {
  for (const b of branchList) {
    if (!finalIdSet.has(b.id)) {
      continue;
    }
    if (b.createdByPhone === sessionPhone) {
      return b.id;
    }
  }
  for (const b of branchList) {
    if (finalIdSet.has(b.id)) {
      return b.id;
    }
  }
  return [...finalIdSet][0] as string;
}

export function BranchSelectClient() {
  const router = useRouter();
  const [session, setSession] = useState<Employee | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [memberships, setMemberships] = useState<BranchMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<BranchCreateForm>({
    profileImageUrl: "",
    name: "",
    businessNumber: "",
    address: "",
    storePhone: "",
  });

  const resetCreateForm = useCallback(() => {
    setCreateForm({
      profileImageUrl: "",
      name: "",
      businessNumber: "",
      address: "",
      storePhone: "",
    });
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateOpen(false);
    resetCreateForm();
  }, [resetCreateForm]);

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
    const ownedBranchIds = all
      .filter((branch) => branch.createdByPhone === dashboard.session?.phone)
      .map((branch) => branch.id);
    const mergedIds = Array.from(
      new Set([
        ...myMemberships.map((item) => item.branchId),
        ...ownedBranchIds,
      ]),
    );
    setSelectedBranchIds(mergedIds);
    const finalSet = new Set(mergedIds);
    const initialDefault =
      dashboard.session.currentBranchId &&
      finalSet.has(dashboard.session.currentBranchId)
        ? dashboard.session.currentBranchId
        : pickDefaultBranchId(
            finalSet,
            all,
            dashboard.session.phone,
          );
    setDefaultBranchId(initialDefault);
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

  const handleCreate = async () => {
    if (!session) {
      return;
    }
    const name = createForm.name.trim();
    const businessNumber = createForm.businessNumber.trim();

    if (!name) {
      toast.error("지점 명을 입력해주세요.");
      return;
    }
    if (!businessNumber) {
      toast.error("사업자 번호를 입력해주세요.");
      return;
    }
    if (!isValidBusinessNumber(businessNumber)) {
      toast.error("사업자 번호는 숫자와 '-'만 입력할 수 있습니다.");
      return;
    }

    setBusy(true);
    await workApi.completeBranchSetup(session.phone, {
      mode: "create",
      branchName: name,
      businessNumber,
      profileImageUrl: createForm.profileImageUrl.trim() || null,
      address: createForm.address.trim() || null,
      storePhone: createForm.storePhone.trim() || null,
    });
    setBusy(false);
    closeCreateModal();
    await refresh();
    toast.success("지점을 생성했고, 기본 지점으로 선택되었습니다.");
  };

  const handleSetDefault = (branchId: string) => {
    if (!session) {
      return;
    }
    const ownedIds = branches
      .filter((b) => b.createdByPhone === session.phone)
      .map((b) => b.id);
    const final = new Set([...selectedBranchIds, ...ownedIds]);
    if (!final.has(branchId)) {
      return;
    }
    if (defaultBranchId === branchId) {
      return;
    }
    const name =
      branches.find((b) => b.id === branchId)?.name ?? "지점";
    setDefaultBranchId(branchId);
    toast.message(`기본 지점을 ${name}로 설정했어요.`);
  };

  const toggleSelection = (branchId: string) => {
    const isOwned = branches.some(
      (branch) =>
        branch.id === branchId && branch.createdByPhone === session?.phone,
    );
    if (isOwned) {
      toast.message("내가 생성한 지점(owner)은 선택 해제할 수 없습니다.");
      return;
    }
    if (!session) {
      return;
    }
    const ownedIds = branches
      .filter((b) => b.createdByPhone === session.phone)
      .map((b) => b.id);
    setSelectedBranchIds((prev) => {
      const next = prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId];
      const final = new Set([...next, ...ownedIds]);
      queueMicrotask(() => {
        setDefaultBranchId((currentDefault) => {
          if (currentDefault && final.has(currentDefault)) {
            return currentDefault;
          }
          if (final.size === 0) {
            return null;
          }
          return pickDefaultBranchId(final, branches, session.phone);
        });
      });
      return next;
    });
  };

  const handleSaveSelection = async () => {
    if (!session) {
      return;
    }
    const ownedBranchIds = branches
      .filter((branch) => branch.createdByPhone === session.phone)
      .map((branch) => branch.id);
    const finalSelectedIds = Array.from(
      new Set([...selectedBranchIds, ...ownedBranchIds]),
    );

    if (finalSelectedIds.length === 0) {
      toast.error("최소 1개 지점을 선택해야 합니다.");
      return;
    }
    const defaultId =
      defaultBranchId && finalSelectedIds.includes(defaultBranchId)
        ? defaultBranchId
        : pickDefaultBranchId(
            new Set(finalSelectedIds),
            branches,
            session.phone,
          );

    const currentIds = memberships.map((item) => item.branchId);
    const toConnect = finalSelectedIds.filter((id) => !currentIds.includes(id));
    const toDisconnect = currentIds.filter(
      (id) => !finalSelectedIds.includes(id) && !ownedBranchIds.includes(id),
    );

    setBusy(true);

    for (const branchId of toConnect) {
      await workApi.connectBranch(session.phone, branchId);
    }
    for (const branchId of toDisconnect) {
      await workApi.disconnectBranch(session.phone, branchId);
    }

    await workApi.completeBranchSetup(session.phone, {
      mode: "select",
      branchId: defaultId,
    });

    await refresh();
    setBusy(false);
    toast.success("선택한 지점을 저장했습니다.");
    router.replace("/");
  };

  if (loading) {
    return <p className="p-4 text-sm text-neutral-400">불러오는 중...</p>;
  }

  const selectedBranches = branches.filter((branch) =>
    selectedBranchIds.includes(branch.id),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          지점 선택
        </h1>
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-[#111113]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-white">
            지점 목록
          </h2>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 dark:border-white/20 dark:bg-[#18181b] dark:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            지점 추가
          </button>
        </div>

        <BranchSelectedTags
          selectedBranches={selectedBranches}
          sessionPhone={session?.phone}
          defaultBranchId={defaultBranchId}
          onSetDefault={handleSetDefault}
          onToggleSelection={toggleSelection}
        />

        <BranchList
          branches={branches}
          selectedBranchIds={selectedBranchIds}
          defaultBranchId={defaultBranchId}
          search={search}
          sessionPhone={session?.phone}
          onSearchChange={setSearch}
          onToggleSelection={toggleSelection}
        />

        <button
          type="button"
          onClick={handleSaveSelection}
          disabled={busy || selectedBranchIds.length === 0}
          className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-950"
        >
          <span className="inline-flex items-center gap-1">
            <Check className="h-4 w-4" />
            {busy ? "저장 중..." : "선택 저장 후 진입"}
          </span>
        </button>
      </section>

      <BranchCreateModal
        open={createOpen}
        busy={busy}
        form={createForm}
        onClose={closeCreateModal}
        onSubmit={handleCreate}
        onChange={(patch) =>
          setCreateForm((prev) => ({
            ...prev,
            ...patch,
          }))
        }
        onBusinessNumberChange={(value) =>
          setCreateForm((prev) => ({
            ...prev,
            businessNumber: sanitizeBusinessNumber(value),
          }))
        }
      />
    </main>
  );
}
