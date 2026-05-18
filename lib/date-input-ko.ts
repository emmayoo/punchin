export type DateInputKoParseResult =
  | { ok: true; iso: string }
  | { ok: false; error: string };

const MIN_YEAR = 1970;
const MAX_YEAR = 2099;

/** `<input type="date">` value (YYYY-MM-DD) */
export function isoToDateInputValue(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoFromParts(year: number, month: number, day: number): string | null {
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}T12:00:00.000Z`;
}

/** `YYYY-MM-DD` → ISO */
export function dateInputValueToIso(value: string): DateInputKoParseResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "입사일을 선택해 주세요." };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return { ok: false, error: "올바른 날짜를 선택해 주세요." };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const iso = isoFromParts(year, month, day);
  if (!iso) {
    return { ok: false, error: "올바른 날짜를 선택해 주세요." };
  }
  return { ok: true, iso };
}

/** 같은 날짜(로컬 기준)인지 */
export function isSameDateIso(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) {
    return !a?.trim() && !b?.trim();
  }
  return isoToDateInputValue(a) === isoToDateInputValue(b);
}
