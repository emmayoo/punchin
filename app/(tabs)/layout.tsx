import type { ReactNode } from "react";
import { TabsShell } from "@/components/layout/tabs-shell";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return <TabsShell>{children}</TabsShell>;
}
