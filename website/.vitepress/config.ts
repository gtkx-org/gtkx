import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defineConfig, type HeadConfig } from "vitepress";
import typedocSidebar from "../reference/typedoc-sidebar.json";

const title = "GTKX";
const description = "Write declarative JSX. GTKX renders it to GObject instances, powered by a native Rust core.";
const url = "https://gtkx.dev";
const ogImage = `${url}/og.png`;

const tutorialItems = [
    { text: "Introduction", link: "/tutorial/" },
    { text: "Your First Window", link: "/tutorial/your-first-window" },
    { text: "A List of Tasks", link: "/tutorial/a-list-of-tasks" },
    { text: "The Task Store", link: "/tutorial/the-task-store" },
    { text: "Interactive Rows", link: "/tutorial/completing-and-deleting" },
    { text: "Saving to Disk", link: "/tutorial/saving-to-disk" },
    { text: "Lists and the Sidebar", link: "/tutorial/lists-and-the-sidebar" },
    { text: "Adaptive Layout", link: "/tutorial/an-adaptive-layout" },
    { text: "Smart Views and Search", link: "/tutorial/smart-views-and-search" },
    { text: "The Task Editor", link: "/tutorial/the-task-editor" },
    { text: "Actions and Menus", link: "/tutorial/actions-menus-shortcuts" },
    { text: "Trash and Toasts", link: "/tutorial/trash-and-toasts" },
    { text: "Preferences and Theming", link: "/tutorial/preferences-and-theming" },
    { text: "Drag to Reorder", link: "/tutorial/drag-to-reorder" },
    { text: "Reminders", link: "/tutorial/reminders" },
    { text: "Appendix A: Testing", link: "/tutorial/testing" },
    { text: "Appendix B: Packaging", link: "/tutorial/packaging" },
    { text: "Appendix C: Flatpak", link: "/tutorial/flatpak" },
];

const guideSidebar = [
    { text: "Why GTKX", link: "/guide/why-gtkx" },
    { text: "Getting Started", link: "/guide/getting-started" },
    { text: "Configuration and Codegen", link: "/guide/configuration-and-codegen" },
    { text: "Async Operations", link: "/guide/async-operations" },
    { text: "Error Handling", link: "/guide/error-handling" },
    { text: "Components and Hooks", link: "/guide/components-and-hooks" },
    { text: "Modals and Portals", link: "/guide/modals-and-portals" },
    { text: "CSS", link: "/guide/css" },
    { text: "OpenGL", link: "/guide/opengl" },
    { text: "Testing", link: "/guide/testing" },
    { text: "MCP", link: "/guide/mcp" },
    { text: "API Reference", link: "/reference/" },
];

const tutorialSidebar = [{ text: "Tutorial", collapsed: false, items: tutorialItems }];
const docItems = [...guideSidebar.filter((item) => !item.link.startsWith("/reference")), ...tutorialItems];
const isProdBuild = process.argv.includes("build");

const fontPreloads: HeadConfig[] = isProdBuild
    ? ["red-hat-display", "red-hat-text", "red-hat-mono"].map(
            (family): HeadConfig => [
                "link",
                {
                    rel: "preload",
                    href: `/fonts/${family}-normal-latin.woff2`,
                    as: "font",
                    type: "font/woff2",
                    crossorigin: "",
                },
            ],
        )
    : [];

const docFile = (link: string): string => (link.endsWith("/") ? `${link.slice(1)}index.md` : `${link.slice(1)}.md`);

const frontmatterHead = (frontmatter: Record<string, unknown>): HeadConfig[] => {
    const existing = frontmatter.head;

    return Array.isArray(existing) ? (existing as HeadConfig[]) : [];
};

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
        ...fontPreloads,
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

        pageData.frontmatter.head = [...frontmatterHead(pageData.frontmatter), ...head];
    },

    async buildEnd(siteConfig) {
        const sources = await Promise.all(
            docItems.map(async (item) => {
                const file = docFile(item.link);
                const source = await readFile(join(siteConfig.srcDir, file), "utf8");
                const target = join(siteConfig.outDir, file);
                await mkdir(dirname(target), { recursive: true });
                await writeFile(target, source);

                return { ...item, file, source };
            }),
        );

        const index = sources.map((s) => `- [${s.text}](${url}/${s.file})`).join("\n");
        const header = `# ${title}\n\n> ${description}\n`;
        await writeFile(join(siteConfig.outDir, "llms.txt"), `${header}\n## Documentation\n\n${index}\n`);

        await writeFile(
            join(siteConfig.outDir, "llms-full.txt"),
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
            { text: "Blog", link: "/blog/" },
            { text: "Examples", link: "https://github.com/gtkx-org/gtkx/tree/main/examples" },
            { text: "1.0 RC", link: "/blog/gtkx-1-0-rc-1" },
        ],
        sidebar: {
            "/guide/": guideSidebar,
            "/tutorial/": tutorialSidebar,
            "/reference/": [{ text: "Overview", link: "/reference/" }, ...typedocSidebar],
            "/blog/": [
                {
                    text: "Blog",
                    items: [{ text: "GTKX 1.0 RC1", link: "/blog/gtkx-1-0-rc-1" }],
                },
            ],
        },
        socialLinks: [{ icon: "github", link: "https://github.com/gtkx-org/gtkx" }],
        editLink: {
            pattern: "https://github.com/gtkx-org/gtkx/edit/main/website/:path",
            text: "Edit this page on GitHub",
        },
        footer: {
            message: "Released under the MPL-2.0 License.",
            copyright: "Copyright © 2026 GTKX contributors",
        },
    },
});
