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
const isPaused = ref(false);

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

watch([video, isInView, reducesMotion, isPaused], ([element, inView, reduced, paused]) => {
    if (element === null) {
        return;
    }

    if (inView && !reduced && !paused) {
        element.muted = true;
        element.play().catch((error: unknown) => {
            isPaused.value = error instanceof DOMException && error.name === "NotAllowedError";
        });
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
            :aria-hidden="hasBeenInView ? 'true' : undefined"
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
            :autoplay="!reducesMotion && !isPaused"
            :controls="reducesMotion"
            :preload="reducesMotion ? 'none' : 'auto'"
            :aria-label="alt"
            loop
            muted
            playsinline
        />
        <button
            v-if="hasBeenInView && !reducesMotion"
            type="button"
            class="clip__toggle"
            :aria-label="isPaused ? 'Play the clip' : 'Pause the clip'"
            @click="isPaused = !isPaused"
        >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path v-if="isPaused" d="M4.5 2.5v11l9-5.5z" />
                <path v-else d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />
            </svg>
        </button>
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
.clip__toggle {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.62);
  fill: #ffffff;
  cursor: pointer;
  opacity: 0;
}
.clip:hover .clip__toggle,
.clip__toggle:focus-visible {
  opacity: 1;
}
.clip__toggle:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
@media (hover: none) {
  .clip__toggle {
    opacity: 0.85;
  }
}
@media (prefers-reduced-motion: no-preference) {
  .clip__toggle {
    transition: opacity var(--dur-fast) var(--ease-standard);
  }
}
</style>
