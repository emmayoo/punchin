"use client";

import { toPng } from "html-to-image";
import { RefObject, useCallback, useState } from "react";

import { toast } from "@/lib/toast";

type UseScheduleImageDownloadInput = {
  targetRef: RefObject<HTMLElement | null>;
  fileName: string;
};

function resolveCaptureBackgroundColor(el: HTMLElement): string {
  let node: HTMLElement | null = el;
  while (node) {
    const bg = window.getComputedStyle(node).backgroundColor;
    if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
      return bg;
    }
    node = node.parentElement;
  }
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  if (bodyBg && bodyBg !== "transparent" && bodyBg !== "rgba(0, 0, 0, 0)") {
    return bodyBg;
  }
  return "#ffffff";
}

export function useScheduleImageDownload({ targetRef, fileName }: UseScheduleImageDownloadInput) {
  const [exportingImage, setExportingImage] = useState(false);

  const downloadScheduleImage = useCallback(async () => {
    const el = targetRef.current;
    if (!el) {
      return;
    }
    setExportingImage(true);
    try {
      if (typeof document !== "undefined" && "fonts" in document) {
        await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      }
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1),
        backgroundColor: resolveCaptureBackgroundColor(el),
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("스케줄 이미지를 저장했습니다.");
    } catch (err) {
      console.error("Failed to export schedule image:", err);
      toast.error("이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setExportingImage(false);
    }
  }, [fileName, targetRef]);

  return { exportingImage, downloadScheduleImage };
}
