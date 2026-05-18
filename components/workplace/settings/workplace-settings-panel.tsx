import type { ReactNode } from "react";

const PANEL_CLASS =
  "rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/5";

type WorkplaceSettingsPanelProps = {
  children: ReactNode;
  className?: string;
};

export function WorkplaceSettingsPanel({ children, className }: WorkplaceSettingsPanelProps) {
  return <div className={className ? `${PANEL_CLASS} ${className}` : PANEL_CLASS}>{children}</div>;
}
