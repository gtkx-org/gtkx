import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, type HeadConfig } from "vitepress";
import typedocSidebar from "../reference/typedoc-sidebar.json";

const title = "GTKX";
const description =
    "Write declarative JSX. GTKX renders real native GTK4 and libadwaita widgets (no webview, no Electron) backed by a Rust GObject runtime.";
const url = "https://gtkx.dev";
const ogImage = `${url}/og.png`;

const tutorialItems = [
    { text: "Introduction", link: "/tutorial/" },
    { text: "The Application Shell", link: "/tutorial/app-shell" },
    { text: "Data Model and Persistence", link: "/tutorial/data-and-persistence" },
    { text: "The Sidebar", link: "/tutorial/the-sidebar" },
    { text: "The Task List", link: "/tutorial/the-task-list" },
    { text: "Task Rows and Drag-to-Reorder", link: "/tutorial/task-rows-and-reordering" },
    { text: "The Task Editor", link: "/tutorial/the-task-editor" },
    { text: "Actions, Menus, and Shortcuts", link: "/tutorial/actions-menus-shortcuts" },
    { text: "Selection Mode", link: "/tutorial/selection-and-batch" },
    { text: "Preferences and Theming", link: "/tutorial/preferences-and-theming" },
    { text: "Reminders and Notifications", link: "/tutorial/notifications" },
    { text: "Feedback and Dialogs", link: "/tutorial/feedback-and-dialogs" },
    { text: "Testing the App", link: "/tutorial/testing" },
    { text: "Packaging and Shipping", link: "/tutorial/packaging" },
];

const sidebarItems = [
    { text: "Why GTKX", link: "/guide/why-gtkx" },
    { text: "Getting Started", link: "/guide/getting-started" },
    { text: "Tutorial", collapsed: false, items: tutorialItems },
    { text: "Configuration and Codegen", link: "/guide/configuration-and-codegen" },
    { text: "Async Operations", link: "/guide/async-operations" },
    { text: "Error Handling", link: "/guide/error-handling" },
    { text: "Components and Hooks", link: "/guide/components-and-hooks" },
    { text: "Modals and Portals", link: "/guide/modals-and-portals" },
    { text: "CSS and Animations", link: "/guide/css-and-animations" },
    { text: "Testing", link: "/guide/testing" },
    { text: "MCP", link: "/guide/mcp" },
    { text: "API Reference", link: "/reference/" },
];

const docItems = sidebarItems.flatMap((item) =>
    "items" in item ? item.items : item.link.startsWith("/reference") ? [] : [item],
);

const docFile = (link: string): string => (link.endsWith("/") ? `${link.slice(1)}index.md` : `${link.slice(1)}.md`);

export default defineConfig({
    title,
    description,
    lang: "en",
    appearance: "dark",
    cleanUrls: true,
    lastUpdated: true,
    sitemap: { hostname: url },
    vite: {
        server: {
            allowedHosts: ["workstation"],
        },
        build: {
            chunkSizeWarningLimit: 700,
        },
    },

    head: [
        ["link", { rel: "icon", type: "image/svg+xml", href: "/gtkx-mark.svg" }],
        ["link", { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" }],
        ["link", { rel: "apple-touch-icon", href: "/apple-touch-icon.png" }],
        ["link", { rel: "manifest", href: "/site.webmanifest" }],
        ["meta", { name: "theme-color", content: "#e03a3e" }],
        [
            "link",
            {
                rel: "preload",
                href: "/fonts/red-hat-display-normal-latin.woff2",
                as: "font",
                type: "font/woff2",
                crossorigin: "",
            },
        ],
        [
            "link",
            {
                rel: "preload",
                href: "/fonts/red-hat-text-normal-latin.woff2",
                as: "font",
                type: "font/woff2",
                crossorigin: "",
            },
        ],
        [
            "link",
            {
                rel: "preload",
                href: "/fonts/red-hat-mono-normal-latin.woff2",
                as: "font",
                type: "font/woff2",
                crossorigin: "",
            },
        ],
        ["meta", { property: "og:type", content: "website" }],
        ["meta", { property: "og:site_name", content: title }],
        ["meta", { property: "og:image", content: ogImage }],
        ["meta", { name: "twitter:card", content: "summary_large_image" }],
        ["meta", { name: "twitter:image", content: ogImage }],
    ],

    transformPageData(pageData) {
        const isHome = pageData.relativePath === "index.md";
        const route = pageData.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
        const pageUrl = route ? `${url}/${route}` : `${url}/`;
        const pageTitle = isHome ? pageData.title : `${pageData.title} | ${title}`;
        const pageDescription = pageData.description || description;
        const head: HeadConfig[] = [
            ["link", { rel: "canonical", href: pageUrl }],
            ["meta", { property: "og:url", content: pageUrl }],
            ["meta", { property: "og:title", content: pageTitle }],
            ["meta", { property: "og:description", content: pageDescription }],
            ["meta", { name: "twitter:title", content: pageTitle }],
            ["meta", { name: "twitter:description", content: pageDescription }],
        ];
        pageData.frontmatter.head = [...(pageData.frontmatter.head ?? []), ...head];
    },

    async buildEnd(siteConfig) {
        const sources = await Promise.all(
            docItems.map(async (item) => {
                const file = docFile(item.link);
                const source = await readFile(path.join(siteConfig.srcDir, file), "utf-8");
                const target = path.join(siteConfig.outDir, file);
                await mkdir(path.dirname(target), { recursive: true });
                await writeFile(target, source);
                return { ...item, file, source };
            }),
        );
        const index = sources.map((s) => `- [${s.text}](${url}/${s.file})`).join("\n");
        const header = `# ${title}\n\n> ${description}\n`;
        await writeFile(path.join(siteConfig.outDir, "llms.txt"), `${header}\n## Documentation\n\n${index}\n`);
        await writeFile(
            path.join(siteConfig.outDir, "llms-full.txt"),
            `${header}\n${sources.map((s) => s.source).join("\n\n---\n\n")}\n`,
        );
    },

    themeConfig: {
        siteTitle: title,
        logo: "/gtkx-mark.svg",
        search: { provider: "local" },
        nav: [
            { text: "Guide", link: "/guide/why-gtkx" },
            { text: "Tutorial", link: "/tutorial/" },
            { text: "Reference", link: "/reference/" },
            { text: "Examples", link: "https://github.com/gtkx-org/gtkx/tree/main/examples" },
            { text: "1.0 RC", link: "https://github.com/gtkx-org/gtkx#status" },
        ],
        sidebar: {
            "/guide/": sidebarItems,
            "/tutorial/": sidebarItems,
            "/reference/": [{ text: "Overview", link: "/reference/" }, ...typedocSidebar],
        },
        socialLinks: [{ icon: "github", link: "https://github.com/gtkx-org/gtkx" }],
        editLink: {
            pattern: "https://github.com/gtkx-org/gtkx/edit/main/website/:path",
            text: "Edit this page on GitHub",
        },
        footer: {
            message: "Released under the MPL-2.0 License.",
            copyright: "Copyright © 2026 gtkx contributors",
        },
    },
});
