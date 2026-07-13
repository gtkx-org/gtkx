import { useData } from "vitepress";

export function useAppearance() {
    const { isDark } = useData();

    const toggle = (): void => {
        isDark.value = !isDark.value;
    };

    return { isDark, toggle };
}
