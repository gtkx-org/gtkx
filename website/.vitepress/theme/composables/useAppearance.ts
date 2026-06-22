import { onMounted, ref } from "vue";

const STORAGE_KEY = "vitepress-theme-appearance";

/**
 * Landing-page light/dark toggle that stays in sync with VitePress's own
 * appearance storage, so the choice persists across the marketing page and the
 * default-theme docs routes. The class is applied on `<html>` exactly as
 * VitePress does, and the preference is mirrored into the same `localStorage`
 * key VitePress reads on load.
 */
export function useAppearance() {
  const isDark = ref(true);

  onMounted(() => {
    isDark.value = document.documentElement.classList.contains("dark");
  });

  const toggle = (): void => {
    isDark.value = !isDark.value;
    document.documentElement.classList.toggle("dark", isDark.value);
    try {
      localStorage.setItem(STORAGE_KEY, isDark.value ? "dark" : "light");
    } catch {}
  };

  return { isDark, toggle };
}
