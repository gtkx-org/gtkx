import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type DefaultTheme, defineConfig, type HeadConfig } from "vitepress";
import stableTypedocSidebar from "../reference/typedoc-sidebar.json" with { type: "json" };
import betaTypedocSidebar from "../v2/reference/typedoc-sidebar.json" with { type: "json" };
import { highlightPlugin } from "./highlight.js";
import {
    type DocumentationItem,
    documentationLink,
    type DocumentationVersion,
    guideItems,
    tutorialItems,
    versionPrefix,
} from "./versioning.js";

const title = "GTKX";
const description = "Write declarative JSX. GTKX renders it to GObject instances, powered by a native Rust core.";
const url = "https://gtkx.dev";
const ogImage = `${url}/og.png`;

type LinkedDocumentationItem = {
    text: string;
    link: string;
};

const sidebarItems = (version: DocumentationVersion, items: DocumentationItem[]): LinkedDocumentationItem[] =>
    items.map((item) => ({ text: item.text, link: documentationLink(version, item.path) }));

const referenceLink = (version: DocumentationVersion, link: string): string => {
    const stableLink = link.replace(/^\/v2\/reference/, "/reference");

    return stableLink.startsWith("/reference") ? `${versionPrefix(version)}${stableLink}` : stableLink;
};

const referenceSidebar = (
    version: DocumentationVersion,
    items: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] =>
    items.map((item) => ({
        ...item,
        ...(item.link && { link: referenceLink(version, item.link) }),
        ...(item.items && { items: referenceSidebar(version, item.items) }),
    }));

const stableGuideSidebar = [
    ...sidebarItems("stable", guideItems),
    { text: "API Reference", link: documentationLink("stable", "reference/") },
];
const betaGuideSidebar = [
    ...sidebarItems("beta", guideItems),
    { text: "API Reference", link: documentationLink("beta", "reference/") },
];
const stableTutorialSidebar = [{ text: "Tutorial", items: sidebarItems("stable", tutorialItems) }];
const betaTutorialSidebar = [{ text: "Tutorial", items: sidebarItems("beta", tutorialItems) }];
const stableReferenceSidebar = referenceSidebar("stable", stableTypedocSidebar);
const betaReferenceSidebar = referenceSidebar("beta", betaTypedocSidebar);
const stableDocItems = [...sidebarItems("stable", guideItems), ...sidebarItems("stable", tutorialItems)];
const betaDocItems = [...sidebarItems("beta", guideItems), ...sidebarItems("beta", tutorialItems)];
const documentationGroups = [
    {
        label: "GTKX 1.6 stable",
        items: stableDocItems,
        referenceLink: documentationLink("stable", "reference/"),
        referenceSidebar: stableReferenceSidebar,
    },
    {
        label: "GTKX 2.0 beta 3",
        items: betaDocItems,
        referenceLink: documentationLink("beta", "reference/"),
        referenceSidebar: betaReferenceSidebar,
    },
];
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

const getPageImage = (frontmatter: Record<string, unknown>): string =>
    typeof frontmatter.image === "string" ? `${url}${frontmatter.image}` : ogImage;

const getOgType = (relativePath: string): string =>
    relativePath !== "blog/index.md" && relativePath.startsWith("blog/") ? "article" : "website";

const navigation = (version: DocumentationVersion): DefaultTheme.NavItem[] => [
    { text: "Guide", link: documentationLink(version, "guide/why-gtkx") },
    { text: "Tutorial", link: documentationLink(version, "tutorial/") },
    { text: "Reference", link: documentationLink(version, "reference/") },
    { text: "Blog", link: "/blog/" },
    {
        text: "Examples",
        link: `https://github.com/gtkx-org/gtkx/tree/${version === "beta" ? "main" : "v1.6.0"}/examples`,
    },
    { component: "VersionSelect" },
];

const blogSidebar: DefaultTheme.SidebarItem[] = [
    {
        text: "Blog",
        items: [
            { text: "GTKX 2.0 beta 1", link: "/blog/gtkx-2-0-beta-1" },
            { text: "GTKX 1.6", link: "/blog/gtkx-1-6" },
            { text: "GTKX 1.5", link: "/blog/gtkx-1-5" },
            { text: "GTKX 1.4", link: "/blog/gtkx-1-4" },
            { text: "GTKX 1.3", link: "/blog/gtkx-1-3" },
            { text: "GTKX 1.1", link: "/blog/gtkx-1-1" },
            { text: "GTKX 1.0", link: "/blog/gtkx-1-0" },
        ],
    },
];

const documentationTitle = (relativePath: string): string => {
    if (/^v2\/(guide|tutorial|reference)\//.test(relativePath)) {
        return "GTKX 2.0 beta 3";
    }

    if (/^(guide|tutorial|reference)\//.test(relativePath)) {
        return "GTKX 1.6 stable";
    }

    return title;
};

const loadDocumentationGroup = async (
    sourceDirectory: string,
    outputDirectory: string,
    group: (typeof documentationGroups)[number],
) => ({
    ...group,
    sources: await Promise.all(
        group.items.map(async (item) => {
            const file = docFile(item.link);
            const source = await readFile(join(sourceDirectory, file), "utf8");
            const target = join(outputDirectory, file);
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, source);

            return { ...item, file, source };
        }),
    ),
});

type LoadedDocumentationGroup = Awaited<ReturnType<typeof loadDocumentationGroup>>;

const llmsIndex = (versions: LoadedDocumentationGroup[]): string =>
    versions
        .map((version) => {
            const pages = version.sources.map((source) => `- [${source.text}](${url}/${source.file})`).join("\n");
            const references = version.referenceSidebar
                .flatMap((entry) => (entry.link ? [`- [${entry.text ?? "API"}](${url}${entry.link})`] : []))
                .join("\n");
            const referenceIndex = `- [API Reference](${url}${version.referenceLink})\n${references}`;

            return [
                `## ${version.label} documentation`,
                pages,
                `### ${version.label} API reference`,
                referenceIndex,
            ].join("\n\n");
        })
        .join("\n\n");

const llmsFull = (versions: LoadedDocumentationGroup[]): string =>
    versions
        .map((version) => {
            const sources = version.sources.map((source) => source.source).join("\n\n---\n\n");

            return `## ${version.label} documentation\n\n${sources}`;
        })
        .join("\n\n---\n\n");

export default defineConfig({
    title,
    description,
    lang: "en",
    locales: {
        root: { label: "Documentation", lang: "en" },
        v2: {
            label: "Documentation",
            lang: "en",
            link: "/v2/guide/why-gtkx",
            themeConfig: {
                nav: navigation("beta"),
            },
        },
    },
    appearance: "dark",
    cleanUrls: true,
    lastUpdated: true,
    sitemap: {
        hostname: url,
        transformItems: (items) => items.map(({ url: itemUrl, lastmod }) => ({ url: itemUrl, lastmod })),
    },
    vite: {
        plugins: [highlightPlugin()],
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
        ["meta", { property: "og:site_name", content: title }],
        ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ],

    transformPageData(pageData) {
        const isHome = pageData.relativePath === "index.md";
        const route = pageData.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
        const pageUrl = route ? `${url}/${route}` : `${url}/`;
        const titleSuffix = documentationTitle(pageData.relativePath);
        const pageTitle = isHome ? pageData.title : `${pageData.title} | ${titleSuffix}`;
        const pageDescription = pageData.description || description;
        const pageImage = getPageImage(pageData.frontmatter);

        if (titleSuffix !== title) {
            pageData.titleTemplate = `:title | ${titleSuffix}`;
        }

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
        const versions = await Promise.all(
            documentationGroups.map((group) => loadDocumentationGroup(siteConfig.srcDir, siteConfig.outDir, group)),
        );
        const header = `# ${title}\n\n> ${description}\n`;

        await writeFile(
            join(siteConfig.outDir, "llms.txt"),
            `${header}\n${llmsIndex(versions)}\n\n## Unversioned content\n\n- [Blog](${url}/blog/)\n`,
        );

        await writeFile(join(siteConfig.outDir, "llms-full.txt"), `${header}\n${llmsFull(versions)}\n`);
    },

    themeConfig: {
        siteTitle: title,
        logo: "/gtkx-mark.svg",
        search: { provider: "local" },
        nav: navigation("stable"),
        sidebar: {
            "/guide/": stableGuideSidebar,
            "/tutorial/": stableTutorialSidebar,
            "/reference/": [{ text: "Overview", link: "/reference/" }, ...stableReferenceSidebar],
            "/v2/guide/": betaGuideSidebar,
            "/v2/tutorial/": betaTutorialSidebar,
            "/v2/reference/": [{ text: "Overview", link: "/v2/reference/" }, ...betaReferenceSidebar],
            "/blog/": blogSidebar,
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
