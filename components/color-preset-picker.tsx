"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { PRESET_COLORS } from "@/lib/constants/color";

export type ColorPresetPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  presets?: readonly string[];
  fallback?: string;
  /** 트리거 버튼 접근성 이름 */
  ariaLabel?: string;
};

function normalizeHex6(raw: string, fallback: string): string {
  const t = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) {
    return t.toLowerCase();
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(t)) {
    const r = t.slice(1);
    return `#${r[0]}${r[0]}${r[1]}${r[1]}${r[2]}${r[2]}`.toLowerCase();
  }
  return fallback;
}

/** 기존 패널(~192px) 대비 약 2/3 너비 */
const PANEL_WIDTH_PX = 128;

export function ColorPresetPicker({
  value,
  onChange,
  disabled,
  presets = PRESET_COLORS,
  fallback = "#22c55e",
  ariaLabel = "색상 선택 열기",
}: ColorPresetPickerProps) {
  const safeHex = useMemo(() => normalizeHex6(value, fallback), [value, fallback]);
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(() => safeHex.replace(/^#/, "").toUpperCase());
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hexInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const swatchRing =
    "ring-2 ring-offset-1 ring-offset-white ring-zinc-900 dark:ring-offset-neutral-950 dark:ring-white";

  const syncDraftFromHex = useCallback((hex: string) => {
    setHexDraft(hex.replace(/^#/, "").toUpperCase());
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) {
      return;
    }
    const r = el.getBoundingClientRect();
    let left = r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - PANEL_WIDTH_PX - 8));
    setCoords({ top: r.bottom + 6, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, safeHex, syncDraftFromHex, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const commitHexDraft = useCallback(() => {
    const digits = hexDraft.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
    if (digits.length === 6) {
      const hex = `#${digits.toLowerCase()}`;
      onChange(hex);
      syncDraftFromHex(hex);
    } else {
      syncDraftFromHex(safeHex);
    }
  }, [hexDraft, onChange, safeHex, syncDraftFromHex]);

  const handleHexInputChange = (raw: string) => {
    const digits = raw.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
    setHexDraft(digits.toUpperCase());
    if (digits.length === 6) {
      onChange(`#${digits.toLowerCase()}`);
    }
  };

  const handlePresetPick = (hex: string) => {
    onChange(hex);
    syncDraftFromHex(hex);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleNativePickerChange = (hex: string) => {
    onChange(hex);
    syncDraftFromHex(hex);
  };

  const toggleOpen = () => {
    if (disabled) {
      return;
    }
    setOpen((previous) => !previous);
  };

  const panel = open ? (
    <div
      ref={panelRef}
      id={listId}
      role="dialog"
      aria-label="색상 선택"
      className="fixed z-200 box-border rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-lg dark:border-white/15 dark:bg-neutral-900 dark:shadow-black/40"
      style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH_PX }}
    >
      <p className="mb-1 px-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-neutral-500">
        기본 색
      </p>
      <div className="grid grid-cols-5 gap-1" role="listbox" aria-label="기본 색상">
        {presets.map((hex) => {
          const normalized = hex.toLowerCase();
          const selected = safeHex === normalized;
          return (
            <button
              key={hex}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => handlePresetPick(hex)}
              className={`aspect-square w-full min-h-0 rounded-md border border-zinc-300/90 transition-transform active:scale-95 dark:border-white/20 ${selected ? swatchRing : ""}`}
              style={{ backgroundColor: hex }}
              aria-label={`색상 ${normalized}`}
            />
          );
        })}
      </div>
      <div className="mt-2 border-t border-zinc-200/80 pt-1.5 dark:border-white/10">
        <p className="mb-1 px-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-neutral-500">
          직접 입력
        </p>
        <div className="flex items-center gap-1">
          <input
            type="color"
            value={safeHex}
            onChange={(event) => handleNativePickerChange(event.target.value)}
            className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-zinc-200/90 bg-white p-0.5 dark:border-white/15 dark:bg-neutral-950"
            aria-label="색상 피커"
          />
          <div className="relative flex min-w-0 flex-1 items-center rounded-md border border-zinc-200/90 bg-zinc-50 dark:border-white/15 dark:bg-neutral-800/80">
            <span className="pointer-events-none pl-1.5 font-mono text-[10px] text-zinc-400 dark:text-neutral-500">
              #
            </span>
            <input
              ref={hexInputRef}
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={6}
              value={hexDraft}
              onChange={(event) => handleHexInputChange(event.target.value)}
              onBlur={() => commitHexDraft()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitHexDraft();
                  hexInputRef.current?.blur();
                }
              }}
              placeholder="RRGGBB"
              className="w-full min-w-0 bg-transparent py-1 pr-1.5 font-mono text-[11px] uppercase tracking-wide text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-neutral-100 dark:placeholder:text-neutral-600"
              aria-label="색상 16진수 6자리"
            />
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? listId : undefined}
        onClick={toggleOpen}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-2 py-1 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 dark:border-white/15 dark:bg-neutral-900 dark:hover:border-white/25 dark:hover:bg-neutral-800/80"
        aria-label={ariaLabel}
      >
        <span
          className="size-5 shrink-0 rounded-md border border-zinc-200/80 dark:border-white/15"
          style={{ backgroundColor: safeHex }}
          aria-hidden
        />
        <ChevronDown
          className={`size-4 shrink-0 text-zinc-500 transition-transform dark:text-neutral-400 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
