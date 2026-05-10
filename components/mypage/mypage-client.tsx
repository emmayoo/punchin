"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { TabPageShell } from "@/components/layout/tab-page-shell";
import { BranchProfileAvatar } from "@/components/branch/branch-profile-avatar";
import {
  getEffectiveBranchRole,
  MypageBranchDetailModal,
} from "@/components/mypage/mypage-branch-detail-modal";
import { ThemeSunMoonToggle } from "@/components/theme/theme-sun-moon-toggle";
import { DashboardData, workApi } from "@/lib/api/work-api";
import { assertValidImageFile } from "@/lib/media/validate-image";
import { formatPhoneNumber } from "@/lib/phone";
import { toast } from "@/lib/toast";
import type { Branch, BranchMembership } from "@/types/work";

export function MyPageClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [memberships, setMemberships] = useState<BranchMembership[]>([]);
  const [branchDetail, setBranchDetail] = useState<{
    branch: Branch;
    membership: BranchMembership;
  } | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreviewUrl, setPendingAvatarPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    const dashboard = await workApi.getDashboard();
    setData(dashboard);
    if (dashboard.session) {
      const [allBranches, myMemberships] = await Promise.all([
        workApi.getBranches(),
        workApi.getMyBranchMemberships(dashboard.session.phone),
      ]);
      setBranches(allBranches);
      setMemberships(myMemberships);
    } else {
      setBranches([]);
      setMemberships([]);
    }
    return dashboard;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await workApi.init();
      if (!mounted) {
        return;
      }
      const dashboard = await refresh();
      if (!mounted) {
        return;
      }
      if (!dashboard.session) {
        router.replace("/auth");
        return;
      }
      setName(dashboard.session.name);
      setPendingAvatarFile(null);
      setRemoveAvatar(false);
      setPendingAvatarPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh, router]);

  useEffect(() => {
    return () => {
      if (pendingAvatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(pendingAvatarPreviewUrl);
      }
    };
  }, [pendingAvatarPreviewUrl]);

  const handleLogout = async () => {
    setBusy(true);
    await workApi.logout();
    router.replace("/auth");
  };

  const handleSaveProfile = async () => {
    if (!data?.session || !name.trim()) {
      return;
    }
    setBusy(true);
    try {
      const nameSaved = await workApi.updateMyProfileName(data.session.phone, name.trim());
      if (!nameSaved) {
        toast.error("이름을 저장하지 못했습니다.");
        return;
      }
      if (removeAvatar) {
        await workApi.updateMyProfileAvatar(data.session.phone, null);
      } else if (pendingAvatarFile) {
        await workApi.updateMyProfileAvatar(data.session.phone, pendingAvatarFile);
      }
      if (pendingAvatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(pendingAvatarPreviewUrl);
      }
      setPendingAvatarFile(null);
      setPendingAvatarPreviewUrl(null);
      setRemoveAvatar(false);
      await refresh();
      toast.success("프로필을 저장했습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleAvatarPick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }
    try {
      assertValidImageFile(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지를 선택할 수 없습니다.");
      return;
    }
    setRemoveAvatar(false);
    setPendingAvatarFile(file);
    setPendingAvatarPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
  };

  const handleAvatarClear = () => {
    setPendingAvatarFile(null);
    setRemoveAvatar(true);
    setPendingAvatarPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  };

  if (!data?.session) {
    return null;
  }
  const myBranches = memberships
    .map((membership) => {
      const branch = branches.find((item) => item.id === membership.branchId);
      if (!branch) {
        return null;
      }
      return { branch, membership };
    })
    .filter((item): item is { branch: Branch; membership: BranchMembership } => item !== null);

  return (
    <TabPageShell title="설정" bodyClassName="gap-8" loading={loading || !data?.session}>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">프로필</h2>
        <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs text-zinc-500 dark:text-neutral-500">로그인 번호</p>
          <p className="mt-1 text-sm text-zinc-800 dark:text-neutral-100">
            {formatPhoneNumber(data.session.phone)}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-zinc-200/90 bg-zinc-100 dark:border-white/15 dark:bg-neutral-900">
            {!removeAvatar && (pendingAvatarPreviewUrl || data.session.avatarUrl) ? (
              <Image
                src={(pendingAvatarPreviewUrl ?? data.session.avatarUrl) as string}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
                unoptimized={
                  Boolean(
                    pendingAvatarPreviewUrl?.startsWith("blob:") ||
                      data.session.avatarUrl?.startsWith("data:"),
                  )
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-500 dark:text-neutral-400">
                {data.session.name.trim().slice(0, 1) || "나"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium text-zinc-600 dark:text-neutral-400">프로필 사진</p>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                handleAvatarPick(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="rounded-lg border border-zinc-300/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 dark:border-white/20 dark:bg-neutral-900 dark:text-white"
              >
                사진 선택
              </button>
              {(pendingAvatarPreviewUrl || data.session.avatarUrl) && !removeAvatar ? (
                <button
                  type="button"
                  onClick={handleAvatarClear}
                  className="rounded-lg border border-zinc-300/90 px-2.5 py-1.5 text-xs text-zinc-700 dark:border-white/20 dark:text-neutral-200"
                >
                  사진 제거
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-600 dark:text-neutral-400">이름 (닉네임)</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="이름 입력"
              className="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35"
            />
          </label>
          <button
            onClick={handleSaveProfile}
            disabled={busy || !name.trim()}
            className="w-full rounded-xl border border-zinc-300/90 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-400 disabled:opacity-60 dark:border-white/20 dark:text-white dark:hover:border-white/40"
          >
            {busy ? "저장 중..." : "프로필 저장"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">앱</h2>
        <div className="rounded-2xl border flex justify-between items-center border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs text-zinc-600 dark:text-neutral-400">테마</p>
          <ThemeSunMoonToggle />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">지점</h2>
        <div className="space-y-2 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
          <div>
            {myBranches.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-neutral-400">
                연결된 지점이 없습니다. 지점 설정에서 선택해 주세요.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {myBranches.map(({ branch, membership }) => {
                  const isDefault = data.session?.currentBranchId === branch.id;
                  return (
                    <li key={membership.id} className="flex items-center justify-between gap-2 ">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <BranchProfileAvatar
                          name={branch.name}
                          profileImageUrl={branch.profileImageUrl}
                          sizePx={36}
                        />
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                          {branch.name}
                        </p>
                        {isDefault ? (
                          <span className="shrink-0 rounded-full bg-zinc-200/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-800 dark:bg-white/15 dark:text-neutral-200">
                            기본
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setBranchDetail({ branch, membership })}
                        className="shrink-0 text-zinc-600 dark:text-neutral-300"
                        aria-label={`${branch.name} 상세 정보`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push("/branch")}
            className="w-full rounded-xl border border-zinc-300/90 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-400 dark:border-white/20 dark:bg-zinc-900/60 dark:text-white dark:hover:border-white/40"
          >
            지점 설정 열기
          </button>
        </div>
      </section>

      <MypageBranchDetailModal
        open={branchDetail !== null}
        branch={branchDetail?.branch ?? null}
        effectiveRole={
          branchDetail
            ? getEffectiveBranchRole(
                branchDetail.branch,
                data.session.phone,
                branchDetail.membership,
              )
            : "staff"
        }
        isDefault={branchDetail ? data.session.currentBranchId === branchDetail.branch.id : false}
        onClose={() => setBranchDetail(null)}
      />

      <button
        onClick={handleLogout}
        disabled={busy}
        className="w-full rounded-xl border border-rose-300/90 bg-rose-400/90 px-4 py-3 text-sm font-semibold text-rose-950 transition-colors hover:bg-rose-300 disabled:opacity-60"
      >
        {busy ? "처리 중..." : "로그아웃"}
      </button>
    </TabPageShell>
  );
}
