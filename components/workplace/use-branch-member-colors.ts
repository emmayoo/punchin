"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { workApi } from "@/lib/api/work-api";
import { DEFAULT_MEMBER_COLOR } from "@/lib/constants/color";
import { onWorkplaceChanged } from "@/lib/constants/dom-event";
import { normalizePhone } from "@/lib/phone";

type UseBranchMemberColorsInput = {
  branchId: string | null;
  actorPhone: string | null;
};

type UseBranchMemberColorsResult = {
  colorByPhone: ReadonlyMap<string, string> | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useBranchMemberColors({
  branchId,
  actorPhone,
}: UseBranchMemberColorsInput): UseBranchMemberColorsResult {
  const [colorByPhone, setColorByPhone] = useState<ReadonlyMap<string, string> | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!branchId || !actorPhone) {
      return;
    }
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setError(null);
    try {
      const members = await workApi.listBranchMembers(branchId, actorPhone);
      const map = new Map<string, string>();
      for (const row of members) {
        const key = normalizePhone(row.phone);
        if (!key) {
          continue;
        }
        const hex = row.color?.trim();
        map.set(key, hex && hex.length > 0 ? hex : DEFAULT_MEMBER_COLOR);
      }
      if (requestIdRef.current === requestId) {
        setColorByPhone(map);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "직원 색상을 불러오지 못했습니다.";
      if (requestIdRef.current === requestId) {
        setError(message);
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [actorPhone, branchId]);

  useEffect(() => {
    if (!branchId || !actorPhone) {
      return undefined;
    }
    queueMicrotask(() => {
      void refresh();
    });
    const off = onWorkplaceChanged(() => {
      void refresh();
    });
    return () => {
      off();
    };
  }, [actorPhone, branchId, refresh]);

  return {
    colorByPhone: branchId && actorPhone ? colorByPhone : undefined,
    loading,
    error,
    refresh,
  };
}
