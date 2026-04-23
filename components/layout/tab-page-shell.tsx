import type { ReactNode } from "react";

export type TabPageShellVariant = "hero" | "standard";

/** `loading`이면 함수는 호출되지 않아, 로딩 중 본문 VNode를 만들지 않습니다. */
export type TabPageShellChildren = ReactNode | (() => ReactNode);

export type TabPageShellProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  variant?: TabPageShellVariant;
  children: TabPageShellChildren;
  footer?: ReactNode;
  /** 헤더·본문·푸터 사이 간격 (`main`의 `gap`) */
  className?: string;
  /** 본문 영역 내부 (`children` 래퍼) */
  bodyClassName?: string;
  /** `true`이면 본문에 `loadingContent`(없을 때는 기본 문구)만 표시합니다. */
  loading?: boolean;
  /** `loading`일 때 본문에 넣을 노드. 생략 시 "불러오는 중..." 문단을 씁니다. */
  loadingContent?: ReactNode;
};

/**
 * 탭 네비게이션이 있는 화면(홈/이력/스케줄/통계/설정)용 공통 골격.
 * 로그인 등 별도 UX는 이 컴포넌트를 쓰지 않는 편이 낫습니다.
 *
 * `loading`과 함께 쓸 때는 `children`에 `() => …` 를 넘기면, 로딩 중에는 호출되지
 * 않아 본문 VNode를 만들지 않습니다. (일반 `ReactNode`는 기존처럼 항상 그립니다.)
 */
const defaultLoadingContent = (
  <p className="text-sm text-zinc-600 dark:text-neutral-400">불러오는 중...</p>
);

function resolveBody(
  loading: boolean,
  children: TabPageShellChildren,
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

export function TabPageShell({
  eyebrow,
  title,
  description,
  variant = "standard",
  children,
  footer,
  className = "",
  bodyClassName = "",
  loading = false,
  loadingContent,
}: TabPageShellProps) {
  const titleClass =
    variant === "hero"
      ? "text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white"
      : "text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white";

  const headerBlockClass = variant === "hero" ? "space-y-3" : "space-y-2";

  const mainClass = [
    "flex min-h-0 flex-1 flex-col",
    className.trim() ? className : "gap-6",
  ].join(" ");

  const bodyWrapperClass = ["flex min-h-0 flex-1 flex-col", bodyClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={mainClass}>
      <header className={`shrink-0 ${headerBlockClass}`}>
        {eyebrow ? (
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-neutral-500">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={titleClass}>{title}</h1>
        {description ? (
          <p className="text-sm text-zinc-600 dark:text-neutral-400">
            {description}
          </p>
        ) : null}
      </header>

      <div className={bodyWrapperClass}>
        {resolveBody(loading, children, loadingContent)}
      </div>

      {footer ? <footer className="shrink-0">{footer}</footer> : null}
    </main>
  );
}
