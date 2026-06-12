<script setup lang="ts">
import { ref } from "vue";

const COMMAND = "npx @gtkx/cli@latest create my-app";
const copied = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | undefined;

const copy = async () => {
    await navigator.clipboard.writeText(COMMAND);
    copied.value = true;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
        copied.value = false;
    }, 2000);
};
</script>

<template>
    <div class="gtkx-install">
        <span class="gtkx-install-prompt" aria-hidden="true">$</span>
        <code class="gtkx-install-cmd">{{ COMMAND }}</code>
        <button type="button" class="gtkx-install-copy" :aria-label="copied ? 'Copied' : 'Copy command'" @click="copy">
            {{ copied ? "Copied!" : "Copy" }}
        </button>
    </div>
</template>
