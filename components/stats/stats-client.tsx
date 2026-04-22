"use client";

import { TabPageShell } from "@/components/layout/tab-page-shell";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RangeWorkStatRow, workApi } from "@/lib/api/work-api";

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatSecondsToHms(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hh = String(Math.floor(safe / 3600)).padStart(2, "0");
  const mm = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function StatsClient() {
  const [rows, setRows] = useState<RangeWorkStatRow[]>([]);
  const [expandedPhones, setExpandedPhones] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => dateKey(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await workApi.init();
      if (startDate > endDate) {
        if (mounted) {
          setRows([]);
          setLoading(false);
        }
        return;
      }
      const stats = await workApi.getRangeWorkStats(startDate, endDate);
      if (!mounted) {
        return;
      }
      setRows(stats.rows);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [startDate, endDate]);

  const invalidRange = useMemo(() => startDate > endDate, [startDate, endDate]);

  const toggleRow = (phone: string) => {
    setExpandedPhones((prev) =>
      prev.includes(phone)
        ? prev.filter((item) => item !== phone)
        : [...prev, phone],
    );
  };

  return (
    <TabPageShell
      title="근무 통계"
      className="gap-5"
      bodyClassName="gap-5"
      loading={loading}
    >
      <section className="grid grid-cols-[1fr_1fr] gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <label className="space-y-1">
          <span className="text-xs text-neutral-400">시작일</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded-xl border border-white/15 bg-neutral-900 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-white/35"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-neutral-400">종료일</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded-xl border border-white/15 bg-neutral-900 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-white/35"
          />
        </label>
      </section>

      <section className="space-y-2">
        {!invalidRange && rows.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-400">
            선택한 기간의 완료된 근무 기록이 없습니다.
          </p>
        ) : null}
        {!invalidRange
          ? rows.map((row) => {
              const open = expandedPhones.includes(row.phone);
              return (
                <article
                  key={row.phone}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <button
                    type="button"
                    onClick={() => toggleRow(row.phone)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {row.name}
                      </p>
                      <p className="text-xs text-neutral-400">{row.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-white">
                          {formatSecondsToHms(row.totalSeconds)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          근무 {row.workCount}회
                        </p>
                      </div>
                      {open ? (
                        <ChevronUp className="h-4 w-4 text-neutral-300" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-neutral-300" />
                      )}
                    </div>
                  </button>

                  {open ? (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      {row.details.map((detail) => (
                        <div
                          key={detail.recordId}
                          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                        >
                          <p className="text-xs text-neutral-300">
                            {new Intl.DateTimeFormat("ko-KR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            }).format(new Date(detail.checkedInAt))}
                            {" ~ "}
                            {new Intl.DateTimeFormat("ko-KR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            }).format(new Date(detail.checkedOutAt))}
                          </p>
                          <p className="mt-1 text-sm font-medium text-white">
                            근무시간 {formatSecondsToHms(detail.workedSeconds)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })
          : null}
      </section>
    </TabPageShell>
  );
}
