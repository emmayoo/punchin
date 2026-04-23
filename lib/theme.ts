/**
 * `next-themes` `ThemeProvider`의 `storageKey`와 반드시 동일해야
 * 첫 페인트 스크립트·localStorage·hydration이 일치합니다.
 */
export const THEME_STORAGE_KEY = "punchin-theme" as const;

const STORAGE_KEY_JSON = JSON.stringify(THEME_STORAGE_KEY);

/**
 * `beforeInteractive`로 `<html class="light|dark">` 를 맞춥니다.
 * - 저장된 값이 `light` / `dark` → 그대로
 * - 없음(`system` 등) → `prefers-color-scheme` 반영
 */
export function buildThemeInitScriptBody(): string {
  return `(() => {
  var root = document.documentElement;
  try {
    var stored = localStorage.getItem(${STORAGE_KEY_JSON});
    root.classList.remove("light", "dark");
    if (stored === "light" || stored === "dark") {
      root.classList.add(stored);
    } else {
      var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "dark" : "light");
    }
  } catch (_e) {
    root.classList.add("light");
  }
})();`;
}
