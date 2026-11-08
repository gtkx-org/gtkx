<script setup lang="ts">
import { useRoute, useRouter } from "vitepress";
import { computed, onBeforeUnmount, ref, useId, useTemplateRef, watch } from "vue";
import { type DocumentationVersion, documentationLink, featuredVersion, versions } from "../../versioning.js";
import { useDocumentationVersion } from "../composables/use-documentation-version";

const STATUS_TEXT = {
    current: "stable",
    prerelease: "prerelease",
    old: "previous",
} as const;

const router = useRouter();
const route = useRoute();
const { version, link, isSamePage } = useDocumentationVersion();
const open = ref(false);
const root = useTemplateRef<HTMLElement>("root");
const button = useTemplateRef<HTMLButtonElement>("button");
const panelId = useId();

const name = (entry: DocumentationVersion): string =>
    entry.status === "prerelease" ? entry.label : entry.id;

const chipText = computed(() =>
    version.value.status === "prerelease" ? version.value.label.split(" ").slice(0, 2).join(" ") : version.value.id,
);

const newestFirst = [...versions].sort((a, b) => b.id.localeCompare(a.id, "en", { numeric: true }));

const entries = computed(() =>
    newestFirst.map((entry) => {
        const active = entry.id === version.value.id;

        return {
            id: entry.id,
            name: name(entry),
            status: STATUS_TEXT[entry.status],
            href: active ? route.path : link(entry),
            active,
            samePage: isSamePage(entry),
        };
    }),
);

const upgradeMajor = featuredVersion.id.split(".", 1)[0] ?? featuredVersion.id;
const upgrade = {
    text: `Upgrading to ${upgradeMajor}.0`,
    href: documentationLink(featuredVersion, `guide/upgrading-to-${upgradeMajor}`),
};

const onPointerDown = (event: PointerEvent) => {
    if (event.target instanceof Node && root.value?.contains(event.target)) {
        return;
    }

    open.value = false;
};

watch(open, (isOpen) => {
    if (isOpen) {
        document.addEventListener("pointerdown", onPointerDown);
    } else {
        document.removeEventListener("pointerdown", onPointerDown);
    }
});

watch(
    () => route.path,
    () => {
        open.value = false;
    },
);

onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointerDown));

const close = () => {
    open.value = false;
    button.value?.focus();
};

const onFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && root.value?.contains(event.relatedTarget)) {
        return;
    }

    open.value = false;
};

const switchVersion = (event: MouseEvent, entry: { href: string; active: boolean; samePage: boolean }) => {
    if (!(entry.active || entry.samePage) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }

    event.preventDefault();

    if (entry.active) {
        close();
        return;
    }

    router.go(`${entry.href}${window.location.search}${window.location.hash}`);
};
</script>

<template>
    <div ref="root" class="version-chip" @keydown.escape="close" @focusout="onFocusOut">
        <button
            ref="button"
            type="button"
            class="chip"
            :aria-expanded="open"
            :aria-controls="panelId"
            :aria-label="`Documentation version: ${version.label}`"
            @click="open = !open"
        >
            <span v-if="version.status !== 'current'" class="dot" :class="version.status" aria-hidden="true"></span>
            {{ chipText }}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div v-show="open" :id="panelId" class="panel">
            <p class="head">Documentation</p>
            <ul>
                <li v-for="entry in entries" :key="entry.id">
                    <a
                        class="link version"
                        :class="{ active: entry.active }"
                        :href="entry.href"
                        :aria-current="entry.active ? 'true' : undefined"
                        @click="switchVersion($event, entry)"
                    >
                        <span>{{ entry.name }}</span>
                        <small>{{ entry.status }}</small>
                    </a>
                </li>
            </ul>
            <ul class="more">
                <li>
                    <a class="link" :href="upgrade.href">{{ upgrade.text }}</a>
                </li>
                <li>
                    <a class="link" href="https://github.com/gtkx-org/gtkx/releases" target="_blank" rel="noreferrer">
                        Release notes
                        <svg class="external" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M7 17 17 7M8 7h9v9" />
                        </svg>
                    </a>
                </li>
                <li><a class="link" href="/versions">All versions</a></li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
.version-chip {
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
}

.chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 999px;
    padding: 0 8px 0 9px;
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    color: var(--vp-c-text-2);
    background: var(--vp-c-bg);
    transition:
        color 0.25s,
        border-color 0.25s;
}

.chip:hover,
.chip[aria-expanded="true"] {
    border-color: var(--vp-c-text-3);
    color: var(--vp-c-text-1);
}

.chip:focus-visible {
    outline: 2px solid var(--vp-c-brand-1);
    outline-offset: 2px;
}

.chip svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
}

.dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--vp-c-text-3);
}

.dot.prerelease {
    background: var(--yellow-500);
}

.panel {
    position: absolute;
    top: calc(100% + 10px);
    inset-inline-start: 0;
    z-index: 30;
    min-width: 264px;
    max-height: calc(100vh - var(--vp-nav-height));
    overflow-y: auto;
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    padding: 12px;
    background: var(--vp-c-bg-elv);
    box-shadow: var(--vp-shadow-3);
}

@media (max-width: 767px) {
    .panel {
        position: fixed;
        top: calc(var(--vp-nav-height) - 4px);
        inset-inline: 16px;
        min-width: 0;
    }
}

.head {
    margin: 0;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 600;
    line-height: 28px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--vp-c-text-3);
}

ul {
    margin: 0;
    padding: 0;
    list-style: none;
}

.more {
    margin: 8px -12px 0;
    border-top: 1px solid var(--vp-c-divider);
    padding: 8px 12px 0;
}

.link {
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 6px;
    padding: 0 12px;
    font-size: 14px;
    font-weight: 500;
    line-height: 32px;
    white-space: nowrap;
    color: var(--vp-c-text-1);
    transition:
        background-color 0.25s,
        color 0.25s;
}

.link:hover {
    background: var(--vp-c-default-soft);
    color: var(--vp-c-brand-1);
}

.version {
    justify-content: space-between;
}

.version small {
    font-size: 12px;
    font-weight: 500;
    color: var(--vp-c-text-3);
}

.version.active,
.version.active small {
    color: var(--vp-c-brand-1);
}

.version.active {
    background: var(--vp-c-brand-soft);
}

.external {
    width: 11px;
    height: 11px;
    fill: none;
    stroke: var(--vp-c-text-3);
    stroke-width: 2;
}
</style>
