import type { Employee } from "@/types/work";

function mapDisplayNameConfirmedAt(row: Record<string, unknown>): string | null | undefined {
  if (!("display_name_confirmed_at" in row)) {
    return undefined;
  }
  const v = row.display_name_confirmed_at;
  if (v === null || v === undefined || String(v).trim() === "") {
    return null;
  }
  return String(v);
}

export function mapBirthDateFromRow(row: Record<string, unknown>): string | null {
  const raw = row.birth_date;
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const text = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function mapEmployeeRow(row: Record<string, unknown>): Employee {
  const rawAvatar = row.avatar_url;
  return {
    id: String(row.id),
    phone: String(row.phone),
    name: String(row.name),
    avatarUrl:
      rawAvatar !== undefined && rawAvatar !== null && String(rawAvatar).trim() !== ""
        ? String(rawAvatar)
        : null,
    birthDate: mapBirthDateFromRow(row),
    currentBranchId: row.current_branch_id ? String(row.current_branch_id) : null,
    displayNameConfirmedAt: mapDisplayNameConfirmedAt(row),
  };
}
