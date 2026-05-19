import { toDateKey } from "@/lib/time";

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 저장·API용 (빈 값 → null, 형식 검증) */
export function normalizeBirthDateInput(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (!BIRTH_DATE_PATTERN.test(trimmed)) {
    return null;
  }
  const parsed = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return trimmed;
}

export function birthDateInputMax(): string {
  return toDateKey(new Date());
}

export type BirthDateValidationError =
  | "invalid_format"
  | "invalid_date"
  | "future_date";

/** UI 저장 전 검증. 통과 시 null, 실패 시 에러 코드 */
export function validateBirthDateInput(value: string): BirthDateValidationError | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (!BIRTH_DATE_PATTERN.test(trimmed)) {
    return "invalid_format";
  }
  const parsed = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "invalid_date";
  }
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (parsed > todayEnd) {
    return "future_date";
  }
  return null;
}

export function birthDateValidationMessage(code: BirthDateValidationError): string {
  switch (code) {
    case "invalid_format":
      return "생년월일 형식이 올바르지 않습니다.";
    case "invalid_date":
      return "생년월일을 확인해 주세요.";
    case "future_date":
      return "미래 날짜는 선택할 수 없습니다.";
  }
}
