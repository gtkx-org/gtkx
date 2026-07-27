import type { Ref } from "vue";
import { useData } from "vitepress";

const flipAppearance = (isDark: Ref<boolean>): void => {
    isDark.value = !isDark.value;
};

function useAppearance() {
    const { isDark } = useData();

    const toggle = (): void => {
        flipAppearance(isDark);
    };

    return { isDark, toggle };
}

export { useAppearance };
