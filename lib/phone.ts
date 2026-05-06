export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
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
