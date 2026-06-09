<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 28 });
</script>

<template>
    <svg :width="size" :height="size" viewBox="0 0 128 128" class="gtkx-mark" aria-hidden="true">
        <defs>
            <linearGradient id="gtkxMarkGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#e03a3e" />
                <stop offset="1" stop-color="#b81c25" />
            </linearGradient>
        </defs>
        <rect width="128" height="128" rx="30" fill="url(#gtkxMarkGradient)" />
        <g fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round">
            <ellipse cx="64" cy="64" rx="42" ry="14" transform="rotate(45 64 64)" />
            <ellipse cx="64" cy="64" rx="42" ry="14" transform="rotate(-45 64 64)" />
        </g>
    </svg>
</template>
