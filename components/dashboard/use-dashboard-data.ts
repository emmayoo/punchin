"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DashboardData, workApi } from "@/lib/api/work-api";

type UseDashboardDataOptions = {
  pollMs?: number | null;
  onData?: (dashboard: DashboardData) => void;
};

const DEFAULT_POLL_MS = 60 * 1000;

export function useDashboardData(options?: UseDashboardDataOptions): {
  data: DashboardData | null;
  loading: boolean;
  refresh: () => Promise<DashboardData>;
} {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const onData = options?.onData;

  const applyDashboard = useCallback(
    (dashboard: DashboardData) => {
      if (!mountedRef.current) {
        return;
      }
      setData(dashboard);
      setLoading(false);
      onData?.(dashboard);
    },
    [onData],
  );

  const refresh = useCallback(async () => {
    const dashboard = await workApi.getDashboard();
    applyDashboard(dashboard);
    return dashboard;
  }, [applyDashboard]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const load = async () => {
      if (cancelled) {
        return;
      }
      await refresh();
    };

    void load();

    const timer =
      pollMs === null
        ? null
        : window.setInterval(() => {
            void refresh();
          }, pollMs);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [pollMs, refresh]);

  return { data, loading, refresh };
}
