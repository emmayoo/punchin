const fieldBase =
  "min-w-0 max-w-full w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35";

export const formFieldClass = `${fieldBase} disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500`;

const dateFieldBase =
  "box-border w-auto min-w-[10.5rem] max-w-[12.5rem] rounded-xl border border-zinc-200/90 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white/35";

/** 날짜 전용 — 한 줄 배치, 내용 길이만큼(전체 너비 X) */
export const formDateInputClass = `${dateFieldBase} disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500 app-date-input [color-scheme:light] dark:[color-scheme:dark]`;

export const formStackClass = "flex min-w-0 flex-col gap-3 overflow-hidden";
