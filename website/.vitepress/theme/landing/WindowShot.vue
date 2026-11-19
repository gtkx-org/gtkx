<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
    defineProps<{
        image: string;
        width: number;
        height: number;
        alt: string;
        eager?: boolean;
    }>(),
    { eager: false },
);

const SCHEMES = ["light", "dark"] as const;
const WINDOW_RADIUS = 15;

const percent = (size: number): string => `${(WINDOW_RADIUS / size) * 100}%`;
const radius = computed(() => `${percent(props.width)} / ${percent(props.height)}`);
</script>

<template>
    <div class="shot">
        <img
            v-for="scheme in SCHEMES"
            :key="scheme"
            class="shot__img"
            :class="`shot__img--${scheme}`"
            :style="{ borderRadius: radius }"
            :src="`${image}-${scheme}.png`"
            :width="width"
            :height="height"
            :loading="eager ? 'eager' : 'lazy'"
            :alt="alt"
        />
    </div>
</template>

<style scoped>
.shot {
  min-width: 0;
}
.shot__img {
  display: block;
  width: 100%;
  height: auto;
  box-shadow: 0 16px 26px var(--wall-shadow);
}
.shot__img--dark,
html.dark .shot__img--light {
  display: none;
}
html.dark .shot__img--dark {
  display: block;
}
</style>
