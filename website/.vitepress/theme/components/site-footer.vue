<script setup lang="ts">
import GtkxMark from "./gtkx-mark.vue";

const repo = "https://github.com/gtkx-org/gtkx";

const columns = [
    {
        title: "Docs",
        links: [
            { text: "Introduction", href: "/docs/introduction" },
            { text: "Getting started", href: "/docs/getting-started" },
            { text: "Tutorial", href: "/docs/tutorial/1-window-and-header-bar" },
            { text: "Styling", href: "/docs/styling" },
            { text: "Testing", href: "/docs/testing" },
        ],
    },
    {
        title: "Reference",
        links: [
            { text: "CLI", href: "/docs/cli" },
            { text: "MCP server", href: "/docs/mcp" },
            { text: "@gtkx/react", href: "/api/react/" },
            { text: "@gtkx/ffi", href: "/api/ffi/" },
            { text: "@gtkx/css", href: "/api/css/" },
        ],
    },
    {
        title: "Community",
        links: [
            { text: "GitHub", href: repo },
            { text: "Releases", href: `${repo}/releases` },
            { text: "Discussions", href: `${repo}/discussions` },
            { text: "Issues", href: `${repo}/issues` },
            { text: "Code of conduct", href: `${repo}/blob/main/CODE_OF_CONDUCT.md` },
            { text: "Contributing", href: `${repo}/blob/main/CONTRIBUTING.md` },
        ],
    },
    {
        title: "Related",
        links: [
            { text: "GTK4 docs", href: "https://docs.gtk.org/gtk4/" },
            { text: "Libadwaita", href: "https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/" },
            { text: "GNOME HIG", href: "https://developer.gnome.org/hig/" },
        ],
    },
];

const year = new Date().getFullYear();
</script>

<template>
    <footer class="gtkx-footer">
        <div class="gtkx-footer-inner">
            <div class="gtkx-footer-brand">
                <GtkxMark :size="36" />
                <div>
                    <div class="gtkx-footer-brand-name">GTKX</div>
                    <div class="gtkx-footer-brand-tag">Native Linux application development for the modern age.</div>
                </div>
            </div>
            <div class="gtkx-footer-cols">
                <div v-for="column in columns" :key="column.title" class="gtkx-footer-col">
                    <div class="gtkx-footer-col-title">{{ column.title }}</div>
                    <a v-for="link in column.links" :key="link.href" :href="link.href">{{ link.text }}</a>
                </div>
            </div>
            <div class="gtkx-footer-legal">
                <div>© {{ year }} the GTKX team · MPL-2.0</div>
                <div class="gtkx-footer-legal-tag">Made for the Linux desktop.</div>
            </div>
        </div>
    </footer>
</template>
