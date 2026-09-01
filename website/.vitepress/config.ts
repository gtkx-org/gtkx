import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defineConfig, type HeadConfig } from "vitepress";
import typedocSidebar from "../reference/typedoc-sidebar.json" with { type: "json" };

const title = "GTKX";
const description = "Write declarative JSX. GTKX renders it to GObject instances, powered by a native Rust core.";
const url = "https://gtkx.dev";
const ogImage = `${url}/og.png`;

const tutorialItems = [
    { text: "Build Tasks", link: "/tutorial/" },
    { text: "State and Persistence", link: "/tutorial/the-task-store" },
    { text: "Adaptive Navigation", link: "/tutorial/an-adaptive-layout" },
    { text: "Desktop Integration", link: "/tutorial/actions-menus-shortcuts" },
    { text: "Testing", link: "/tutorial/testing" },
    { text: "Packaging", link: "/tutorial/packaging" },
];

const guideSidebar = [
    { text: "Why GTKX", link: "/guide/why-gtkx" },
    { text: "Getting Started", link: "/guide/getting-started" },
    { text: "Configuration and Codegen", link: "/guide/configuration-and-codegen" },
    { text: "Async Operations", link: "/guide/async-operations" },
    { text: "Error Handling", link: "/guide/error-handling" },
    { text: "Subclassing GObject", link: "/guide/subclassing" },
    { text: "Components", link: "/guide/components" },
    { text: "Forms", link: "/guide/forms" },
    { text: "Modals and Portals", link: "/guide/modals-and-portals" },
    { text: "Navigation", link: "/guide/navigation" },
    { text: "CSS", link: "/guide/css" },
    { text: "Animations", link: "/guide/animations" },
    { text: "Cairo", link: "/guide/cairo" },
    { text: "OpenGL", link: "/guide/opengl" },
    { text: "Internationalization", link: "/guide/internationalization" },
    { text: "Testing", link: "/guide/testing" },
    { text: "MCP", link: "/guide/mcp" },
    { text: "Deploying", link: "/guide/deploying" },
    { text: "Upgrading to 2.0", link: "/guide/upgrading-to-2" },
    { text: "API Reference", link: "/reference/" },
];

const tutorialSidebar = [{ text: "Tutorial", items: tutorialItems }];
const docItems = [...guideSidebar.filter((item) => !item.link.startsWith("/reference")), ...tutorialItems];
const docFile = (link: string): string => (link.endsWith("/") ? `${link.slice(1)}index.md` : `${link.slice(1)}.md`);

const frontmatterHead = (frontmatter: Record<string, unknown>): HeadConfig[] => {
    const existing = frontmatter.head;

    return Array.isArray(existing) ? (existing as HeadConfig[]) : [];
};

const getPageImage = (frontmatter: Record<string, unknown>): string =>
    typeof frontmatter.image === "string" ? `${url}${frontmatter.image}` : ogImage;

const getOgType = (relativePath: string): string =>
    relativePath !== "blog/index.md" && relativePath.startsWith("blog/") ? "article" : "website";

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
        ["meta", { property: "og:site_name", content: title }],
        ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ],

    transformPageData(pageData) {
        const isHome = pageData.relativePath === "index.md";
        const route = pageData.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
        const pageUrl = route ? `${url}/${route}` : `${url}/`;
        const pageTitle = isHome ? pageData.title : `${pageData.title} | ${title}`;
        const pageDescription = pageData.description || description;
        const pageImage = getPageImage(pageData.frontmatter);

        const head: HeadConfig[] = [
            ["link", { rel: "canonical", href: pageUrl }],
            ["meta", { property: "og:type", content: getOgType(pageData.relativePath) }],
            ["meta", { property: "og:url", content: pageUrl }],
            ["meta", { property: "og:title", content: pageTitle }],
            ["meta", { property: "og:description", content: pageDescription }],
            ["meta", { property: "og:image", content: pageImage }],
            ["meta", { name: "twitter:title", content: pageTitle }],
            ["meta", { name: "twitter:description", content: pageDescription }],
            ["meta", { name: "twitter:image", content: pageImage }],
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

        const optional = [
            `- [API Reference](${url}/reference/): generated TypeScript API for every published package`,
            ...typedocSidebar.map((entry) => `- [${entry.text}](${url}${entry.link})`),
            `- [Blog](${url}/blog/)`,
        ].join("\n");

        await writeFile(
            join(siteConfig.outDir, "llms.txt"),
            `${header}\n## Documentation\n\n${index}\n\n## Optional\n\n${optional}\n`,
        );

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
            { text: "2.0", link: "/guide/upgrading-to-2" },
        ],
        sidebar: {
            "/guide/": guideSidebar,
            "/tutorial/": tutorialSidebar,
            "/reference/": [{ text: "Overview", link: "/reference/" }, ...typedocSidebar],
            "/blog/": [
                {
                    text: "Blog",
                    items: [
                        { text: "GTKX 1.6", link: "/blog/gtkx-1-6" },
                        { text: "GTKX 1.5", link: "/blog/gtkx-1-5" },
                        { text: "GTKX 1.4", link: "/blog/gtkx-1-4" },
                        { text: "GTKX 1.3", link: "/blog/gtkx-1-3" },
                        { text: "GTKX 1.1", link: "/blog/gtkx-1-1" },
                        { text: "GTKX 1.0", link: "/blog/gtkx-1-0" },
                    ],
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
