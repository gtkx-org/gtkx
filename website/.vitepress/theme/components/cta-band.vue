<script setup lang="ts">
import { onMounted, ref } from "vue";
import InstallCommand from "./install-command.vue";

const stars = ref<string | null>(null);

onMounted(async () => {
    try {
        const response = await fetch("https://api.github.com/repos/gtkx-org/gtkx");
        if (!response.ok) return;
        const data: { stargazers_count?: number } = await response.json();
        if (typeof data.stargazers_count === "number") {
            stars.value = new Intl.NumberFormat("en-US", { notation: "compact" }).format(data.stargazers_count);
        }
    } catch {
        stars.value = null;
    }
});
</script>

<template>
    <section class="gtkx-cta">
        <div class="gtkx-cta-inner">
            <h2 class="gtkx-cta-title">The Linux desktop is ready for you.</h2>
            <p class="gtkx-cta-sub">
                Scaffold an app, run it with hot reload, and ship a native bundle — in minutes.
            </p>
            <InstallCommand />
            <div class="gtkx-cta-actions">
                <a class="gtkx-cta-button" href="/docs/getting-started">Get started</a>
                <a class="gtkx-cta-button alt" href="https://github.com/gtkx-org/gtkx">
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path
                            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
                        />
                    </svg>
                    <span>GitHub</span>
                    <span v-if="stars" class="gtkx-cta-stars">★ {{ stars }}</span>
                </a>
            </div>
            <div class="gtkx-cta-meta">Open source · MPL-2.0 · Built in the open</div>
        </div>
    </section>
</template>
