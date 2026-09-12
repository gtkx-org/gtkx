import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type DefaultTheme, defineConfig, type HeadConfig } from "vitepress";
import { highlightPlugin } from "./highlight.js";
import {
    currentVersion,
    type DocumentationItem,
    documentationItems,
    documentationLink,
    type DocumentationVersion,
    GUIDE_ROOT,
    guideItems,
    normalizeDocumentationPath,
    REFERENCE_ROOT,
    resolveVersionPath,
    retentionPolicy,
    rootVersion,
    TUTORIAL_ROOT,
    tutorialItems,
    versionForPath,
    versions,
} from "./versioning.js";

const title = "GTKX";
const description = "Build native GNOME apps with React and TypeScript on an Adwaita-first foundation.";
const url = "https://gtkx.dev";
const ogImage = `${url}/og.png`;
const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const referencePath = `/${REFERENCE_ROOT.replace(/\/$/, "")}`;
const sectionDirectories = ["guide", "tutorial"];

type LinkedDocumentationItem = {
    text: string;
    link: string;
};

const versionDirectory = (version: DocumentationVersion): string =>
    join(websiteRoot, version.prefix.replace(/^\//, ""));

const markdownRoutes = (directory: string, base: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
            return markdownRoutes(path, `${base}${entry.name}/`);
        }

        if (!entry.name.endsWith(".md")) {
            return [];
        }

        return entry.name === "index.md" ? [base] : [`${base}${entry.name.replace(/\.md$/, "")}`];
    });

const sectionRoutes = (version: DocumentationVersion, section: string): string[] => {
    const directory = join(versionDirectory(version), section);

    return existsSync(directory) ? markdownRoutes(directory, `${section}/`) : [];
};

const versionRoutes = (version: DocumentationVersion): Set<string> => {
    const routes = sectionDirectories.flatMap((section) => sectionRoutes(version, section));
    const known = new Set(documentationItems.map((item) => item.path));
    const unlisted = routes.filter((route) => !known.has(route));

    if (unlisted.length > 0) {
        const missing = unlisted.join(", ");

        throw new Error(
            `GTKX ${version.label} has pages missing from the lists in versioning.ts: ${missing}.`,
        );
    }

    if (existsSync(join(versionDirectory(version), REFERENCE_ROOT, "index.md"))) {
        routes.push(REFERENCE_ROOT);
    }

    return new Set(routes);
};

const canonicalRoutes = (version: DocumentationVersion): Set<string> => {
    const sections = [...sectionDirectories, REFERENCE_ROOT.replace(/\/$/, "")];

    return new Set(sections.flatMap((section) => sectionRoutes(version, section)));
};

const canonicalRoutesByVersion = new Map(versions.map((version) => [version.id, canonicalRoutes(version)]));

const hasCanonicalPage = (version: DocumentationVersion, path: string): boolean =>
    canonicalRoutesByVersion.get(version.id)?.has(path) ?? false;

const routesByVersion: Map<string, Set<string>> = new Map(
    versions.map((version): [string, Set<string>] => [version.id, versionRoutes(version)]),
);

const hasPage = (version: DocumentationVersion, path: string): boolean =>
    routesByVersion.get(version.id)?.has(path) ?? false;

const sidebarItems = (version: DocumentationVersion, items: DocumentationItem[]): LinkedDocumentationItem[] =>
    items
        .filter((item) => hasPage(version, item.path))
        .map((item) => ({ text: item.text, link: documentationLink(version, item.path) }));

const referenceLink = (version: DocumentationVersion, link: string): string => {
    const at = link.startsWith("/") ? link.indexOf(`${referencePath}/`) : -1;

    return at === -1 ? link : `${version.prefix}${link.slice(at)}`;
};

const rewriteReferenceSidebar = (
    version: DocumentationVersion,
    items: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] =>
    items.map((item) => ({
        ...item,
        ...(item.link && { link: referenceLink(version, item.link) }),
        ...(item.items && { items: rewriteReferenceSidebar(version, item.items) }),
    }));

const parseSidebar = (source: string): DefaultTheme.SidebarItem[] => {
    const parsed: unknown = JSON.parse(source);

    return Array.isArray(parsed) ? (parsed as DefaultTheme.SidebarItem[]) : [];
};

const referenceSidebar = (version: DocumentationVersion): DefaultTheme.SidebarItem[] => {
    const manifest = join(versionDirectory(version), REFERENCE_ROOT, "typedoc-sidebar.json");

    return rewriteReferenceSidebar(version, parseSidebar(readFileSync(manifest, "utf8")));
};

const referenceSidebars = new Map(versions.map((version) => [version.id, referenceSidebar(version)]));

const versionReferenceSidebar = (version: DocumentationVersion): DefaultTheme.SidebarItem[] =>
    referenceSidebars.get(version.id) ?? [];

const guideSidebar = (version: DocumentationVersion): DefaultTheme.SidebarItem[] => [
    ...sidebarItems(version, guideItems),
    { text: "API Reference", link: documentationLink(version, REFERENCE_ROOT) },
];

const tutorialSidebar = (version: DocumentationVersion): DefaultTheme.SidebarItem[] => [
    { text: "Tutorial", items: sidebarItems(version, tutorialItems) },
];

const blogSidebar: DefaultTheme.SidebarItem[] = [
    {
        text: "Blog",
        items: [
            { text: "GTKX 2.0 beta", link: "/blog/gtkx-2-0-beta-1" },
            { text: "GTKX 1.6", link: "/blog/gtkx-1-6" },
            { text: "GTKX 1.5", link: "/blog/gtkx-1-5" },
            { text: "GTKX 1.4", link: "/blog/gtkx-1-4" },
            { text: "GTKX 1.3", link: "/blog/gtkx-1-3" },
            { text: "GTKX 1.1", link: "/blog/gtkx-1-1" },
            { text: "GTKX 1.0", link: "/blog/gtkx-1-0" },
        ],
    },
];

const navigation = (version: DocumentationVersion): DefaultTheme.NavItem[] => [
    { text: "Guide", link: documentationLink(version, GUIDE_ROOT) },
    { text: "Tutorial", link: documentationLink(version, TUTORIAL_ROOT) },
    { text: "Reference", link: documentationLink(version, REFERENCE_ROOT) },
    { text: "Blog", link: "/blog/" },
    { text: "Examples", link: `https://github.com/gtkx-org/gtkx/tree/${version.examplesRef}/examples` },
    { component: "VersionSelect" },
];

const versionSidebars = (version: DocumentationVersion): [string, DefaultTheme.SidebarItem[]][] => [
    [`${version.prefix}/guide/`, guideSidebar(version)],
    [`${version.prefix}/tutorial/`, tutorialSidebar(version)],
    [
        `${version.prefix}${referencePath}/`,
        [{ text: "Overview", link: documentationLink(version, REFERENCE_ROOT) }, ...versionReferenceSidebar(version)],
    ],
];

const sidebar: DefaultTheme.Sidebar = {
    ...Object.fromEntries(versions.flatMap((version) => versionSidebars(version))),
    "/blog/": blogSidebar,
};

type LocaleEntry = {
    label: string;
    lang: string;
    link?: string;
    themeConfig?: { nav: DefaultTheme.NavItem[] };
};

const prefixedLocale = (version: DocumentationVersion): [string, LocaleEntry] => [
    version.prefix.slice(1),
    {
        label: "Documentation",
        lang: "en",
        link: documentationLink(version, GUIDE_ROOT),
        themeConfig: { nav: navigation(version) },
    },
];

const prefixedVersions = versions.filter((version) => version.prefix !== "");

const locales: Record<string, LocaleEntry> = {
    root: { label: "Documentation", lang: "en" },
    ...Object.fromEntries(prefixedVersions.map((version) => prefixedLocale(version))),
};

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

const isDocumentationRoute = (route: string): boolean =>
    /^(guide|tutorial|reference)\//.test(normalizeDocumentationPath(`/${route}`));

const documentationTitle = (route: string): string => {
    const { label } = versionForPath(`/${route}`);

    return isDocumentationRoute(route) ? `GTKX ${label}` : title;
};

type VersionLink = {
    href: string;
    samePage: boolean;
};

const counterpartLink = (target: DocumentationVersion, route: string): VersionLink => ({
    href: resolveVersionPath(`/${route}`, target, hasCanonicalPage),
    samePage: hasCanonicalPage(target, normalizeDocumentationPath(`/${route}`)),
});

const versionLinks = (route: string): Record<string, VersionLink> => {
    const active = versionForPath(`/${route}`);
    const others = versions.filter((version) => version.id !== active.id);
    const entries = others.map((version): [string, VersionLink] => [version.id, counterpartLink(version, route)]);

    return Object.fromEntries(entries);
};

const canonicalRoute = (route: string): string => {
    const version = versionForPath(`/${route}`);

    if (version.status !== "old" || !isDocumentationRoute(route)) {
        return route;
    }

    const path = normalizeDocumentationPath(`/${route}`);

    return hasCanonicalPage(currentVersion, path) ? documentationLink(currentVersion, path).replace(/^\//, "") : route;
};

const loadDocumentationVersion = async (
    sourceDirectory: string,
    outputDirectory: string,
    version: DocumentationVersion,
) => ({
    version,
    sources: await Promise.all(
        documentationItems
            .filter((item) => hasPage(version, item.path))
            .map(async (item) => {
                const file = docFile(documentationLink(version, item.path));
                const source = await readFile(join(sourceDirectory, file), "utf8");
                const target = join(outputDirectory, file);
                await mkdir(dirname(target), { recursive: true });
                await writeFile(target, source);

                return { text: item.text, file, source };
            }),
    ),
});

type LoadedDocumentationVersion = Awaited<ReturnType<typeof loadDocumentationVersion>>;

const currentIndex = `${url}${currentVersion.prefix}/llms.txt`;

const currentNote = `The current release is GTKX ${currentVersion.label}, documented at ${currentIndex}.`;

const statusNote = (version: DocumentationVersion): string => {
    if (version.status === "prerelease") {
        return `GTKX ${version.label} is a pre-release. ${currentNote}`;
    }

    if (version.status === "old") {
        return `GTKX ${version.label} is no longer the current release. ${currentNote}`;
    }

    return `GTKX ${version.label} is the current release.`;
};

const otherVersionsSection = (version: DocumentationVersion): string => {
    const others = versions.filter((other) => other.id !== version.id);

    if (others.length === 0) {
        return "";
    }

    const links = others.map((other) => `- [GTKX ${other.label}](${url}${other.prefix}/llms.txt)`).join("\n");

    return `\n## Other versions\n\n${links}\n`;
};

const llmsHeader = (version: DocumentationVersion): string =>
    [
        `# ${title} ${version.label}`,
        "",
        `> ${description}`,
        "",
        `@doc-version: ${version.id}`,
        `@doc-status: ${version.status}`,
        "",
        statusNote(version),
        "",
        retentionPolicy,
        "",
    ].join("\n");

const llmsIndex = (loaded: LoadedDocumentationVersion): string => {
    const pages = loaded.sources.map((source) => `- [${source.text}](${url}/${source.file})`).join("\n");
    const references = versionReferenceSidebar(loaded.version)
        .flatMap((entry) => (entry.link ? [`- [${entry.text ?? "API"}](${url}${entry.link})`] : []))
        .join("\n");
    const referenceHome = `${url}${documentationLink(loaded.version, REFERENCE_ROOT)}`;
    const referenceIndex = `- [API Reference](${referenceHome})\n${references}`;

    return [
        llmsHeader(loaded.version),
        `## GTKX ${loaded.version.label} documentation`,
        "",
        pages,
        "",
        `## GTKX ${loaded.version.label} API reference`,
        "",
        referenceIndex,
        "",
        "## Unversioned content",
        "",
        `- [Blog](${url}/blog/)`,
        otherVersionsSection(loaded.version),
    ].join("\n");
};

const llmsFull = (loaded: LoadedDocumentationVersion): string =>
    [
        llmsHeader(loaded.version),
        `## GTKX ${loaded.version.label} documentation`,
        "",
        loaded.sources.map((source) => source.source).join("\n\n---\n\n"),
        otherVersionsSection(loaded.version),
    ].join("\n");

export default defineConfig({
    title,
    description,
    lang: "en",
    locales,
    appearance: "dark",
    cleanUrls: true,
    lastUpdated: true,
    sitemap: {
        hostname: url,
        transformItems: (items) =>
            items
                .filter(({ url: itemUrl }) => canonicalRoute(itemUrl) === itemUrl)
                .map(({ url: itemUrl, lastmod }) => ({ url: itemUrl, lastmod })),
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
        const canonical = canonicalRoute(route);
        const canonicalUrl = canonical ? `${url}/${canonical}` : `${url}/`;
        const titleSuffix = documentationTitle(route);
        const pageTitle = isHome ? pageData.title : `${pageData.title} | ${titleSuffix}`;
        const pageDescription = pageData.description || description;
        const pageImage = getPageImage(pageData.frontmatter);

        if (titleSuffix !== title) {
            pageData.titleTemplate = `:title | ${titleSuffix}`;
        }

        const head: HeadConfig[] = [
            ["link", { rel: "canonical", href: canonicalUrl }],
            ["meta", { property: "og:type", content: getOgType(pageData.relativePath) }],
            ["meta", { property: "og:url", content: canonicalUrl }],
            ["meta", { property: "og:title", content: pageTitle }],
            ["meta", { property: "og:description", content: pageDescription }],
            ["meta", { property: "og:image", content: pageImage }],
            ["meta", { name: "twitter:title", content: pageTitle }],
            ["meta", { name: "twitter:description", content: pageDescription }],
            ["meta", { name: "twitter:image", content: pageImage }],
        ];

        pageData.frontmatter.versionId = versionForPath(`/${route}`).id;
        pageData.frontmatter.versionLinks = versionLinks(route);
        pageData.frontmatter.head = [...frontmatterHead(pageData.frontmatter), ...head];
    },

    async buildEnd(siteConfig) {
        const loaded = await Promise.all(
            versions.map((version) => loadDocumentationVersion(siteConfig.srcDir, siteConfig.outDir, version)),
        );

        await Promise.all(
            loaded.map(async (version) => {
                const directory = join(siteConfig.outDir, version.version.prefix.replace(/^\//, ""));
                await mkdir(directory, { recursive: true });
                await writeFile(join(directory, "llms.txt"), llmsIndex(version));
                await writeFile(join(directory, "llms-full.txt"), llmsFull(version));
            }),
        );
    },

    themeConfig: {
        siteTitle: title,
        logo: "/gtkx-mark.svg",
        search: { provider: "local" },
        nav: navigation(rootVersion),
        sidebar,
        socialLinks: [{ icon: "github", link: "https://github.com/gtkx-org/gtkx" }],
        editLink: {
            pattern: "https://github.com/gtkx-org/gtkx/edit/main/website/:path",
            text: "Edit this page on GitHub",
        },
        footer: {
            message: 'Released under the MPL-2.0 License. <a href="/versions">Documentation versions</a>.',
            copyright: "Copyright © 2026 GTKX contributors",
        },
    },
});
