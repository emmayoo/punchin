"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** `loading`이면 함수는 호출되지 않아, 로딩 중 본문 VNode를 만들지 않습니다. */
export type DetailPageShellChildren = ReactNode | (() => ReactNode);

type DetailPageShellBase = {
  backLabel?: ReactNode;
  title?: ReactNode;
  children: DetailPageShellChildren;
  className?: string;
  contentClassName?: string;
  "aria-label"?: string;
  /** 본문에 로딩 UI만 표시. `children`이 함수면 `loading`이 끝난 뒤에만 호출됩니다. */
  loading?: boolean;
  /** `loading`일 때 본문. 생략 시 "불러오는 중..." */
  loadingContent?: ReactNode;
};

export type DetailPageShellProps = DetailPageShellBase &
  (
    | { backHref: string; onBack?: never }
    | { onBack: () => void; backHref?: never }
  );

const backButtonClassName =
  "inline-flex w-fit min-h-10 min-w-10 shrink-0 items-center justify-center gap-0.5 rounded-xl pl-1 pr-3 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white active:bg-white/10 touch-manipulation";

const defaultLoadingContent = (
  <p className="text-sm text-neutral-400">불러오는 중...</p>
);

function resolveBody(
  loading: boolean,
  children: DetailPageShellChildren,
  loadingContent: ReactNode | undefined,
): ReactNode {
  if (loading) {
    return loadingContent ?? defaultLoadingContent;
  }
  if (typeof children === "function") {
    return children();
  }
  return children;
}

/**
 * 하단 탭을 쓰지 않는 상세/서브 화면. 헤더는 뒤로가기, `title`은 선택.
 * `loading`과 함께 쓸 때는 `children`에 `() => …` 를 넘기면, 로딩이 끝날 때까지
 * 본문 함수는 호출되지 않습니다. 탭 nav는 `TabsShell`에서 경로에 따라 끕니다.
 */
export function DetailPageShell(props: DetailPageShellProps) {
  const {
    backLabel = "뒤로",
    title,
    children,
    className = "",
    contentClassName = "",
    "aria-label": ariaLabel,
    loading = false,
    loadingContent,
  } = props;

  const labelNode =
    typeof backLabel === "string" || typeof backLabel === "number" ? (
      <span>{backLabel}</span>
    ) : (
      backLabel
    );

  const backIcon = (
    <ChevronLeft
      className="h-5 w-5 shrink-0"
      strokeWidth={2}
      aria-hidden
    />
  );

  let backControl: ReactNode;
  if ("backHref" in props) {
    const { backHref: href } = props;
    if (typeof href !== "string" || !href) {
      throw new Error("DetailPageShell: `backHref`이 올바르지 않습니다.");
    }
    backControl = (
      <Link
        href={href}
        className={backButtonClassName}
        aria-label="이전 화면으로 돌아가기"
      >
        {backIcon}
        {labelNode}
      </Link>
    );
  } else {
    const { onBack } = props;
    backControl = (
      <button
        type="button"
        onClick={onBack}
        className={backButtonClassName}
        aria-label="이전 화면으로 돌아가기"
      >
        {backIcon}
        {labelNode}
      </button>
    );
  }

  return (
    <main
      className={["flex min-h-0 flex-1 flex-col gap-4", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={ariaLabel}
    >
      <header className="shrink-0">
        <div className="flex min-h-10 items-center gap-2">
          {backControl}
          {title ? (
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold leading-tight tracking-tight text-white">
              {title}
            </h1>
          ) : null}
        </div>
      </header>

      <div
        className={["flex min-h-0 flex-1 flex-col gap-4", contentClassName]
          .filter(Boolean)
          .join(" ")}
      >
        {resolveBody(loading, children, loadingContent)}
      </div>
    </main>
  );
}
