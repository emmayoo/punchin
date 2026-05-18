export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** 휴대폰 010xxxxxxxx (11자리) */
export function isMobile010(digits: string): boolean {
  return /^010\d{8}$/.test(digits);
}

export function formatPhoneNumber(value: string): string {
  const digits = normalizePhone(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
