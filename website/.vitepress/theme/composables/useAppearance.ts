import { onMounted, ref } from "vue";

const STORAGE_KEY = "vitepress-theme-appearance";

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
