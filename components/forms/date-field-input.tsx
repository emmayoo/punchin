import type { InputHTMLAttributes } from "react";

import { formDateInputClass } from "@/lib/forms/input-classes";

type DateFieldInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** iOS Safari `type="date"` — 라벨 아래 내용 너비만 사용 */
export function DateFieldInput({ className = "", ...props }: DateFieldInputProps) {
  return (
    <div className="w-fit max-w-full">
      <input
        type="date"
        className={[formDateInputClass, className].filter(Boolean).join(" ")}
        {...props}
      />
    </div>
  );
}
