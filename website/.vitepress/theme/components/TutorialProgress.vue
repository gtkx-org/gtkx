<script setup lang="ts">
import { computed } from "vue";
import { useTutorialPosition } from "../composables/use-tutorial-position";

const position = useTutorialPosition();

const progress = computed(() => {
    const current = position.value;

    if (current?.chapter === undefined) {
        return undefined;
    }

    return { chapter: current.chapter, total: current.total, width: `${(current.chapter / current.total) * 100}%` };
});
</script>

<template>
    <p v-if="progress" class="tutorial-progress">
        <span> Chapter {{ progress.chapter }} <span class="total">of {{ progress.total }}</span> </span>
        <span class="bar" aria-hidden="true"><span class="fill" :style="{ width: progress.width }"></span></span>
    </p>
</template>

<style scoped>
.tutorial-progress {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.5;
    color: var(--vp-c-brand-1);
}

.total {
    font-weight: 500;
    color: var(--vp-c-text-2);
}

.bar {
    flex: 1;
    max-width: 160px;
    height: 4px;
    border-radius: 2px;
    background: var(--vp-c-default-soft);
    overflow: hidden;
}

.fill {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: var(--vp-c-brand-1);
}
</style>
