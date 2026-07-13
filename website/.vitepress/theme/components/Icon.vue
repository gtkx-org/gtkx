<script setup lang="ts">
import { computed } from "vue";

type IconEl = { d?: string; cx?: number; cy?: number; r?: number };

const ICONS: Record<string, { fill?: boolean; els: IconEl[] }> = {
    arrow: { els: [{ d: "M5 12h14M13 6l6 6-6 6" }] },
    github: {
        fill: true,
        els: [
            {
                d: "M12 2A10 10 0 0 0 8.84 21.5c.5.08.66-.22.66-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.9-1.29 2.74-1.02 2.74-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.16.57.67.48A10 10 0 0 0 12 2Z",
            },
        ],
    },
    sun: {
        els: [
            { cx: 12, cy: 12, r: 4 },
            { d: "M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" },
        ],
    },
    moon: { els: [{ d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" }] },
    search: { els: [{ cx: 11, cy: 11, r: 7 }, { d: "m21 21-4.3-4.3" }] },
    check: { els: [{ d: "M20 6 9 17l-5-5" }] },
    menu: { els: [{ d: "M3 6h18M3 12h18M3 18h18" }] },
    close: { els: [{ d: "M18 6 6 18M6 6l12 12" }] },
    copy: {
        els: [
            { d: "M10 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" },
            { d: "M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" },
        ],
    },
    external: { els: [{ d: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }] },
};

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 });
const def = computed(() => ICONS[props.name] ?? ICONS.arrow);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="def.fill ? 'currentColor' : 'none'"
    :stroke="def.fill ? 'none' : 'currentColor'"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-for="(el, i) in def.els" :key="i">
      <circle v-if="el.r" :cx="el.cx" :cy="el.cy" :r="el.r" />
      <path v-else :d="el.d" />
    </template>
  </svg>
</template>
