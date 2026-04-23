"use client";

import { useTheme } from "next-themes";
import { startTransition, useEffect, useState } from "react";
import { Toaster } from "sonner";

export function AppToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Toaster
      position="top-center"
      closeButton
      richColors
      duration={4_000}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
