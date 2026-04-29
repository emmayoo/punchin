"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DetailPageShell } from "@/components/layout/detail-page-shell";
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

const inputClass =
  "w-full rounded-xl border border-zinc-200/90 bg-white px-2 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35";

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
      prev.includes(phone) ? prev.filter((item) => item !== phone) : [...prev, phone],
    );
  };

  return (
    <DetailPageShell backHref="/workplace" title="통계" loading={loading}>
      {() => (
        <>
          <section className="grid grid-cols-[1fr_1fr] gap-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
            <label className="space-y-1">
              <span className="text-xs text-zinc-600 dark:text-neutral-400">시작일</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-zinc-600 dark:text-neutral-400">종료일</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className={inputClass}
              />
            </label>
          </section>

          <section className="space-y-2">
            {!invalidRange && rows.length === 0 ? (
              <p className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
                선택한 기간의 완료된 근무 기록이 없습니다.
              </p>
            ) : null}
            {!invalidRange
              ? rows.map((row) => {
                  const open = expandedPhones.includes(row.phone);
                  return (
                    <article
                      key={row.phone}
                      className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <button
                        type="button"
                        onClick={() => toggleRow(row.phone)}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">
                            {row.name}
                          </p>
                          <p className="text-xs text-zinc-600 dark:text-neutral-400">{row.phone}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                              {formatSecondsToHms(row.totalSeconds)}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-neutral-500">
                              근무 {row.workCount}회
                            </p>
                          </div>
                          {open ? (
                            <ChevronUp className="h-4 w-4 text-zinc-500 dark:text-neutral-300" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-neutral-300" />
                          )}
                        </div>
                      </button>

                      {open ? (
                        <div className="mt-3 space-y-2 border-t border-zinc-200/90 pt-3 dark:border-white/10">
                          {row.details.map((detail) => (
                            <div
                              key={detail.recordId}
                              className="rounded-xl border border-zinc-200/80 bg-zinc-100/80 px-3 py-2 dark:border-white/10 dark:bg-black/20"
                            >
                              <p className="text-xs text-zinc-600 dark:text-neutral-300">
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
                              <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
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
        </>
      )}
    </DetailPageShell>
  );
}
