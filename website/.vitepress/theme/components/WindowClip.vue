<script setup lang="ts">
import { useData } from "vitepress";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
    name: string;
    width: number;
    height: number;
    alt: string;
}>();

const SCHEMES = ["light", "dark"] as const;
const WINDOW_RADIUS = 15;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const { isDark } = useData();
const root = ref<HTMLElement | null>(null);
const video = ref<HTMLVideoElement | null>(null);
const isInView = ref(false);
const hasBeenInView = ref(false);
const reducesMotion = ref(false);

const scheme = computed(() => (isDark.value ? "dark" : "light"));
const file = (variant: string, extension: string): string => `/clips/${props.name}-${variant}.${extension}`;
const percent = (size: number): string => `${(WINDOW_RADIUS / size) * 100}%`;
const frame = computed(() => ({
    "--clip-width": `${props.width}px`,
    aspectRatio: `${props.width} / ${props.height}`,
    borderRadius: `${percent(props.width)} / ${percent(props.height)}`,
}));

let observer: IntersectionObserver | undefined;
let motion: MediaQueryList | undefined;

const onMotionChange = (event: MediaQueryListEvent): void => {
    reducesMotion.value = event.matches;
};

onMounted(() => {
    motion = window.matchMedia(REDUCED_MOTION);
    reducesMotion.value = motion.matches;
    motion.addEventListener("change", onMotionChange);
    observer = new IntersectionObserver(
        ([entry]) => {
            isInView.value = entry?.isIntersecting === true;
            hasBeenInView.value ||= isInView.value;
        },
        { rootMargin: "200px" },
    );

    if (root.value !== null) {
        observer.observe(root.value);
    }
});

onBeforeUnmount(() => {
    observer?.disconnect();
    motion?.removeEventListener("change", onMotionChange);
});

watch([video, isInView, reducesMotion], ([element, inView, reduced]) => {
    if (element === null) {
        return;
    }

    if (inView && !reduced) {
        element.muted = true;
        element.play().catch(() => undefined);
    } else {
        element.pause();
    }
});
</script>

<template>
    <div ref="root" class="clip" :style="frame">
        <img
            v-for="variant in SCHEMES"
            :key="variant"
            class="clip__poster"
            :class="`clip__poster--${variant}`"
            :src="file(variant, 'png')"
            :width="width"
            :height="height"
            loading="lazy"
            :alt="alt"
        />
        <video
            v-if="hasBeenInView"
            ref="video"
            :key="scheme"
            class="clip__video"
            :src="file(scheme, 'webm')"
            :poster="file(scheme, 'png')"
            :width="width"
            :height="height"
            :autoplay="!reducesMotion"
            :controls="reducesMotion"
            :preload="reducesMotion ? 'none' : 'auto'"
            :aria-label="alt"
            loop
            muted
            playsinline
        />
    </div>
</template>

<style scoped>
.clip {
  position: relative;
  width: 100%;
  max-width: var(--clip-max-width, var(--clip-width));
  overflow: hidden;
  box-shadow: var(--clip-shadow, 0 8px 20px rgba(0, 0, 0, 0.16));
}
.clip .clip__poster,
.clip .clip__video {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  margin: 0;
  border-radius: 0;
  filter: none;
}
.clip .clip__poster--dark,
html.dark .clip .clip__poster--light {
  display: none;
}
html.dark .clip .clip__poster--dark {
  display: block;
}
</style>
