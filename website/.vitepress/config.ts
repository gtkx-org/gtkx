import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type DefaultTheme, defineConfig, type HeadConfig } from "vitepress";
import { groupIconMdPlugin, groupIconVitePlugin } from "vitepress-plugin-group-icons";
import { CONTRIBUTING_ROOT, contributingItems } from "./contributing.js";
import { highlightPlugin } from "./highlight.js";
import { figureLinks, optionTables } from "./markdown.js";
import {
    currentVersion,
    type DocumentationItem,
    documentationLink,
    type DocumentationVersion,
    GUIDE_ROOT,
    guideGroups,
    isDocumentationPath,
    normalizeDocumentationPath,
    REFERENCE_ROOT,
    resolveVersionPath,
    retentionPolicy,
    rootVersion,
    TUTORIAL_ROOT,
    tutorialPointerPaths,
    versionDocumentationItems,
    versionForPath,
    type VersionLink,
    versions,
    versionTutorialItems,
} from "./versioning.js";

const title = "GTKX";
const description =
    "The React framework for Linux. Build native Adwaita and GTK apps with the workflow of modern web development.";
const url = "https://gtkx.dev";
const ogImage = `${url}/og.png`;
const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const referencePath = `/${REFERENCE_ROOT.replace(/\/$/, "")}`;
const sectionDirectories = ["guide", "tutorial"];
const configTypes = "@gtkx/config/index/type-aliases/";
const configPage = `${REFERENCE_ROOT}${configTypes}Config`;

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

const codeTitlePattern = /^\s*(?:`{3,}|~{3,}|<<<).*\[([^\]]+)\]/gm;

/**
 * Lists every code block title in the guides and tutorials. `groupIconVitePlugin` only learns the titles of
 * pages it transforms before it writes its icon stylesheet, which during a build misses most `<<<` snippets.
 */
const codeBlockTitles = (): string[] =>
    versions.flatMap((version) =>
        sectionDirectories.flatMap((section) => {
            const directory = join(versionDirectory(version), section);

            if (!existsSync(directory)) {
                return [];
            }

            return readdirSync(directory, { recursive: true, encoding: "utf8" })
                .filter((path) => path.endsWith(".md"))
                .flatMap((path) => [...readFileSync(join(directory, path), "utf8").matchAll(codeTitlePattern)])
                .flatMap(([, codeTitle]) => (codeTitle ? [codeTitle] : []));
        }),
    );

const versionRoutes = (version: DocumentationVersion): Set<string> => {
    const routes = sectionDirectories.flatMap((section) => sectionRoutes(version, section));
    const known = new Set([...versionDocumentationItems(version).map((item) => item.path), ...tutorialPointerPaths]);
    const unlisted = routes.filter((route) => !known.has(route));

    if (unlisted.length > 0) {
        const missing = unlisted.join(", ");

        throw new Error(`GTKX ${version.label} has pages missing from the lists in versioning.ts: ${missing}.`);
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

    if (!Array.isArray(parsed)) {
        throw new TypeError("The generated TypeDoc sidebar must be an array.");
    }

    return parsed as DefaultTheme.SidebarItem[];
};

const referenceSidebar = (version: DocumentationVersion): DefaultTheme.SidebarItem[] => {
    const manifest = join(versionDirectory(version), REFERENCE_ROOT, "typedoc-sidebar.json");

    return rewriteReferenceSidebar(version, parseSidebar(readFileSync(manifest, "utf8")));
};

const referenceSidebars = new Map(versions.map((version) => [version.id, referenceSidebar(version)]));

const versionReferenceSidebar = (version: DocumentationVersion): DefaultTheme.SidebarItem[] =>
    referenceSidebars.get(version.id) ?? [];

const largestBrowsableReferenceTree = 500;

const sidebarSize = (items: DefaultTheme.SidebarItem[] = []): number =>
    items.reduce((total, item) => total + 1 + sidebarSize(item.items), 0);

const isBrowsablePackage = (item: DefaultTheme.SidebarItem): boolean =>
    sidebarSize(item.items) <= largestBrowsableReferenceTree;

const packageLink = ({ text, link }: DefaultTheme.SidebarItem): DefaultTheme.SidebarItem => ({ text, link });

const referenceOverview = (version: DocumentationVersion): DefaultTheme.SidebarItem => ({
    text: "Overview",
    link: documentationLink(version, REFERENCE_ROOT),
});

const packageSidebar = (
    version: DocumentationVersion,
    current: DefaultTheme.SidebarItem,
): DefaultTheme.SidebarItem[] => [
    referenceOverview(version),
    ...versionReferenceSidebar(version).map((item) => (item === current ? item : packageLink(item))),
];

const referenceSidebarEntries = (version: DocumentationVersion): [string, DefaultTheme.SidebarItem[]][] => [
    [
        `${version.prefix}${referencePath}/`,
        [referenceOverview(version), ...versionReferenceSidebar(version).map(packageLink)],
    ],
    ...versionReferenceSidebar(version).flatMap((item): [string, DefaultTheme.SidebarItem[]][] =>
        item.link && isBrowsablePackage(item) ? [[item.link, packageSidebar(version, item)]] : [],
    ),
];

const unlistedReferencePackages = versions.flatMap((version) =>
    versionReferenceSidebar(version).flatMap((item) => (item.link && !isBrowsablePackage(item) ? [item.link] : [])),
);

const isUnlistedReferencePage = (path: string): boolean =>
    unlistedReferencePackages.some((link) => path !== link && path.startsWith(link));

const configLinks = (version: DocumentationVersion, text: string): LinkedDocumentationItem[] =>
    hasCanonicalPage(version, configPage) ? [{ text, link: documentationLink(version, configPage) }] : [];

const guideSidebar = (version: DocumentationVersion): DefaultTheme.SidebarItem[] => [
    ...guideGroups
        .map((group) => ({ text: group.text, items: sidebarItems(version, group.items) }))
        .filter((group) => group.items.length > 0),
    ...configLinks(version, "Config Reference"),
    { text: "API Reference", link: documentationLink(version, REFERENCE_ROOT) },
];

const tutorialSidebar = (version: DocumentationVersion): DefaultTheme.SidebarItem[] => [
    { text: "Tutorial", items: sidebarItems(version, versionTutorialItems(version)) },
];

const contributingLinks = contributingItems.map((item) => ({ text: item.text, link: `/${item.path}` }));

const contributingSidebar: DefaultTheme.SidebarItem[] = [{ text: "Contributing", items: contributingLinks }];

const blogSidebar: DefaultTheme.SidebarItem[] = [
    {
        text: "Blog",
        items: [
            { text: "GTKX 2.0", link: "/blog/gtkx-2-0" },
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
    { text: "Guide", link: documentationLink(version, GUIDE_ROOT), activeMatch: `${version.prefix}/guide/` },
    ...configLinks(version, "Config").map((item) => ({
        ...item,
        activeMatch: `${version.prefix}/${REFERENCE_ROOT}${configTypes}`,
    })),
    { text: "Tutorial", link: documentationLink(version, TUTORIAL_ROOT), activeMatch: `${version.prefix}/tutorial/` },
    {
        text: "API Reference",
        link: documentationLink(version, REFERENCE_ROOT),
        activeMatch: `${version.prefix}/${REFERENCE_ROOT}(?!${configTypes})`,
    },
    { text: "Examples", link: `https://github.com/gtkx-org/gtkx/tree/${version.examplesRef}/examples` },
    {
        text: "Project",
        activeMatch: "^/(contributing/|blog/|releases)",
        items: [
            { text: "Contributing", link: `/${CONTRIBUTING_ROOT}` },
            { text: "Blog", link: "/blog/" },
            { text: "Releases", link: "/releases" },
            { text: "Changelog", link: "https://github.com/gtkx-org/gtkx/releases" },
            { text: "Discussions", link: "https://github.com/gtkx-org/gtkx/discussions" },
            { text: "Sponsor", link: "https://opencollective.com/gtkx" },
        ],
    },
];

const versionSidebars = (version: DocumentationVersion): [string, DefaultTheme.SidebarItem[]][] => [
    [`${version.prefix}/guide/`, guideSidebar(version)],
    [`${version.prefix}/tutorial/`, tutorialSidebar(version)],
    ...referenceSidebarEntries(version),
];

const sidebar: DefaultTheme.Sidebar = {
    ...Object.fromEntries(versions.flatMap((version) => versionSidebars(version))),
    [`/${CONTRIBUTING_ROOT}`]: contributingSidebar,
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

const searchLocale = (version: DocumentationVersion): [string, DefaultTheme.LocalSearchOptions] => [
    version.prefix === "" ? "root" : version.prefix.slice(1),
    {
        translations: {
            button: { buttonText: `Search ${version.id} docs`, buttonAriaLabel: `Search the GTKX ${version.id} docs` },
        },
    },
];

const locales: Record<string, LocaleEntry> = {
    root: { label: "Documentation", lang: "en" },
    ...Object.fromEntries(prefixedVersions.map((version) => prefixedLocale(version))),
};

const isProdBuild = process.argv.includes("build");

const fontPreloads: HeadConfig[] = isProdBuild
    ? ["red-hat-display", "red-hat-text", "red-hat-mono"].map((family): HeadConfig => [
          "link",
          {
              rel: "preload",
              href: `/fonts/${family}-normal-latin.woff2`,
              as: "font",
              type: "font/woff2",
              crossorigin: "",
          },
      ])
    : [];

const docFile = (link: string): string => (link.endsWith("/") ? `${link.slice(1)}index.md` : `${link.slice(1)}.md`);

const markdownCopies = new Set([
    ...versions.flatMap((version) =>
        sidebarItems(version, versionDocumentationItems(version)).map((item) => item.link),
    ),
    ...contributingLinks.map((item) => item.link),
]);

const isTutorialPointer = (route: string): boolean => {
    const path = normalizeDocumentationPath(`/${route}`);
    const chapters = versionTutorialItems(versionForPath(`/${route}`));

    return tutorialPointerPaths.includes(path) && !chapters.some((item) => item.path === path);
};

const snippetImport = /^([ \t]*)<<< @\/(.+?)(\{[^}]*\})?(?:[ \t]*\[([^\]]+)\])?[ \t]*$/gm;

/**
 * Replaces each `<<< @/` snippet import with the fenced file it imports, so the Markdown copies served next to the
 * pages and the `llms-full.txt` bundles carry the code instead of a path only VitePress can resolve.
 */
const inlineSnippets = async (sourceDirectory: string, source: string): Promise<string> => {
    const imports = [...source.matchAll(snippetImport)];
    const files = await Promise.all(
        imports.map(([, , path = ""]) => readFile(join(sourceDirectory, path.trim()), "utf8")),
    );

    return imports.reduce((result, [line, indent = "", path = "", , codeTitle], index) => {
        const language = path.trim().split(".").pop() ?? "";
        const info = codeTitle ? `${language} [${codeTitle}]` : language;
        const code = (files[index] ?? "").replace(/\n$/, "");
        const fence = "`".repeat(Math.max(3, ...[...code.matchAll(/`{3,}/g)].map(([run]) => run.length + 1)));
        const block = [`${fence}${info}`, ...code.split("\n"), fence].map((text) => (text ? `${indent}${text}` : text));

        return result.replace(line, () => block.join("\n"));
    }, source);
};

const frontmatterHead = (frontmatter: Record<string, unknown>): HeadConfig[] => {
    const existing = frontmatter.head;

    return Array.isArray(existing) ? (existing as HeadConfig[]) : [];
};

const getPageImage = (frontmatter: Record<string, unknown>): string =>
    typeof frontmatter.image === "string" ? `${url}${frontmatter.image}` : ogImage;

const getOgType = (relativePath: string): string =>
    relativePath !== "blog/index.md" && relativePath.startsWith("blog/") ? "article" : "website";

const documentationTitle = (route: string): string => {
    const { label } = versionForPath(`/${route}`);

    return isDocumentationPath(route) ? `GTKX ${label}` : title;
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

    if (version.status !== "old" || !isDocumentationPath(route)) {
        return route;
    }

    const path = normalizeDocumentationPath(`/${route}`);

    return hasCanonicalPage(currentVersion, path) ? documentationLink(currentVersion, path).replace(/^\//, "") : route;
};

const loadDocumentationSources = async (
    sourceDirectory: string,
    outputDirectory: string,
    items: LinkedDocumentationItem[],
) =>
    Promise.all(
        items.map(async (item) => {
            const file = docFile(item.link);
            const source = await inlineSnippets(sourceDirectory, await readFile(join(sourceDirectory, file), "utf8"));
            const target = join(outputDirectory, file);
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, source);

            return { text: item.text, file, source };
        }),
    );

type DocumentationSources = Awaited<ReturnType<typeof loadDocumentationSources>>;

const loadDocumentationVersion = async (
    sourceDirectory: string,
    outputDirectory: string,
    version: DocumentationVersion,
) => ({
    version,
    sources: await loadDocumentationSources(
        sourceDirectory,
        outputDirectory,
        sidebarItems(version, versionDocumentationItems(version)),
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

const llmsIndex = (loaded: LoadedDocumentationVersion, contributing: DocumentationSources): string => {
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
        "The contributing documentation describes development on main.",
        "",
        ...contributing.map((source) => `- [Contributing: ${source.text}](${url}/${source.file})`),
        `- [Blog](${url}/blog/)`,
        otherVersionsSection(loaded.version),
    ].join("\n");
};

const llmsFull = (loaded: LoadedDocumentationVersion, contributing: DocumentationSources): string =>
    [
        llmsHeader(loaded.version),
        `## GTKX ${loaded.version.label} documentation`,
        "",
        loaded.sources.map((source) => source.source).join("\n\n---\n\n"),
        "",
        "## Contributing to GTKX",
        "",
        contributing.map((source) => source.source).join("\n\n---\n\n"),
        otherVersionsSection(loaded.version),
    ].join("\n");

const writeAliasPage = async (
    outputDirectory: string,
    alias: string,
    version: DocumentationVersion,
    route: string,
): Promise<void> => {
    const destination = documentationLink(version, route);
    const canonical = `${url}${destination}`;
    const file = route.endsWith("/") ? `${route}index.html` : `${route}.html`;
    const target = join(outputDirectory, alias.slice(1), file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(
        target,
        `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Page moved | GTKX</title>
<link rel="canonical" href="${canonical}">
<script>location.replace(${JSON.stringify(destination)} + location.search + location.hash)</script>
<noscript><meta http-equiv="refresh" content="0;url=${destination}"></noscript>
</head><body><a href="${destination}">Continue to the GTKX documentation</a></body></html>
`,
    );
};

const writeVersionAliases = async (
    outputDirectory: string,
    loaded: LoadedDocumentationVersion,
    contributing: DocumentationSources,
): Promise<void> => {
    const version = loaded.version;
    const routes = canonicalRoutesByVersion.get(version.id) ?? new Set<string>();

    for (const alias of version.aliases) {
        for (const route of routes) {
            await writeAliasPage(outputDirectory, alias, version, route);
        }

        const aliasDirectory = join(outputDirectory, alias.slice(1));
        await mkdir(aliasDirectory, { recursive: true });
        await writeFile(join(aliasDirectory, "llms.txt"), llmsIndex(loaded, contributing));
        await writeFile(join(aliasDirectory, "llms-full.txt"), llmsFull(loaded, contributing));

        for (const source of loaded.sources) {
            const target = join(aliasDirectory, source.file.slice(version.prefix.length));
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, source.source);
        }
    }
};

export default defineConfig({
    title,
    description,
    lang: "en",
    locales,
    appearance: true,
    cleanUrls: true,
    lastUpdated: true,
    srcExclude: ["figures/**"],
    markdown: {
        container: {
            infoLabel: "Info",
            noteLabel: "Note",
            tipLabel: "Tip",
            importantLabel: "Important",
            warningLabel: "Warning",
            cautionLabel: "Caution",
            dangerLabel: "Danger",
            detailsLabel: "Details",
        },
        config(md) {
            md.use(groupIconMdPlugin);
            md.use(optionTables);
            md.use(figureLinks);
        },
    },
    sitemap: {
        hostname: url,
        transformItems: (items) =>
            items
                .filter(({ url: itemUrl }) => canonicalRoute(itemUrl) === itemUrl && !isTutorialPointer(itemUrl))
                .map(({ url: itemUrl, lastmod }) => ({ url: itemUrl, lastmod })),
    },
    vite: {
        plugins: [highlightPlugin(), groupIconVitePlugin({ defaultLabels: codeBlockTitles() })],
        resolve: {
            alias: [
                {
                    find: /^\.\/VPNavBarTitle\.vue$/,
                    replacement: fileURLToPath(new URL("./theme/components/NavBarTitle.vue", import.meta.url)),
                },
            ],
        },
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

        if (markdownCopies.has(`/${route}`)) {
            head.push(["link", { rel: "alternate", type: "text/markdown", href: `/${docFile(`/${route}`)}` }]);
        }

        if (isTutorialPointer(route)) {
            head.push(["meta", { name: "robots", content: "noindex" }]);
        }

        if (isUnlistedReferencePage(`/${route}`)) {
            pageData.frontmatter.prev = false;
            pageData.frontmatter.next = false;
        }

        pageData.frontmatter.versionId = versionForPath(`/${route}`).id;
        pageData.frontmatter.versionLinks = versionLinks(route);
        pageData.frontmatter.head = [...frontmatterHead(pageData.frontmatter), ...head];
    },

    async buildEnd(siteConfig) {
        const contributing = await loadDocumentationSources(siteConfig.srcDir, siteConfig.outDir, contributingLinks);
        const loaded = await Promise.all(
            versions.map((version) => loadDocumentationVersion(siteConfig.srcDir, siteConfig.outDir, version)),
        );

        await Promise.all(
            loaded.map(async (version) => {
                const directory = join(siteConfig.outDir, version.version.prefix.replace(/^\//, ""));
                await mkdir(directory, { recursive: true });
                await writeFile(join(directory, "llms.txt"), llmsIndex(version, contributing));
                await writeFile(join(directory, "llms-full.txt"), llmsFull(version, contributing));
                await writeVersionAliases(siteConfig.outDir, version, contributing);
            }),
        );
    },

    themeConfig: {
        siteTitle: false,
        logo: { light: "/logo-wordmark-light.svg", dark: "/logo-wordmark-dark.svg", alt: "GTKX" },
        search: {
            provider: "local",
            options: {
                _render: async (source, env, md) => {
                    const html = await md.renderAsync(source, env);
                    const search = env.frontmatter?.search;

                    if (search === false) {
                        return "";
                    }

                    if (search !== "title") {
                        return html;
                    }

                    const page = /^(<p>[\s\S]*?<\/p>)\s*(<h1[\s\S]*?<\/h1>)/u.exec(html);

                    return page ? `${page[2]}${page[1]}` : "";
                },
                miniSearch: {
                    searchOptions: {
                        boostDocument: (id: string) => (/^\/(blog|contributing)\//.test(id) ? 0.5 : 1),
                    },
                },
                locales: Object.fromEntries(versions.map((version) => searchLocale(version))),
            },
        },
        nav: navigation(rootVersion),
        sidebar,
        outline: { level: [2, 3] },
        socialLinks: [{ icon: "github", link: "https://github.com/gtkx-org/gtkx" }],
        editLink: {
            pattern: "https://github.com/gtkx-org/gtkx/edit/main/website/:path",
            text: "Edit this page on GitHub",
        },
        lastUpdated: { formatOptions: { dateStyle: "medium" } },
        notFound: {
            quote: "The page may have moved or been renamed. Search the documentation, or start again from the home page.",
        },
        footer: {
            message: 'Released under the MPL-2.0 License. <a href="/versions">Documentation versions</a>.',
            copyright: "Copyright © 2026 GTKX contributors",
        },
    },
});
