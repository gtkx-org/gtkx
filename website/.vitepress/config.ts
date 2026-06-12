import { type DefaultTheme, defineConfig, type HeadConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import animateSidebar from "../api/animate/typedoc-sidebar.json" with { type: "json" };
import cssSidebar from "../api/css/typedoc-sidebar.json" with { type: "json" };
import ffiSidebar from "../api/ffi/typedoc-sidebar.json" with { type: "json" };
import reactSidebar from "../api/react/typedoc-sidebar.json" with { type: "json" };
import testingSidebar from "../api/testing/typedoc-sidebar.json" with { type: "json" };

const SITE_URL = "https://gtkx.dev";
const SITE_TITLE = "GTKX — Native Linux application development for the modern age";
const SITE_DESCRIPTION =
    "Native Linux application development for the modern age. React 19 renders to real GTK4 and Libadwaita widgets on Node.js — no Electron, no WebView.";

const prepareTypedocSidebar = (items: DefaultTheme.SidebarItem[]): DefaultTheme.SidebarItem[] =>
    items.map((item) => {
        const link = item.link?.replace(/^\/website/, "").replace(/\.md$/, "");
        const children = item.items ? prepareTypedocSidebar(item.items) : undefined;
        return { ...item, ...(link ? { link } : {}), ...(children ? { items: children } : {}) };
    });

export default defineConfig({
    title: "GTKX",
    description: SITE_DESCRIPTION,
    appearance: true,
    sitemap: {
        hostname: SITE_URL,
    },
    vite: {
        plugins: [
            llmstxt({
                domain: SITE_URL,
                ignoreFiles: ["api/**/*"],
                customLLMsTxtTemplate: `# {title}

> {description}

{details}

## Table of Contents

{toc}

## Optional

- [GitHub Repository](https://github.com/gtkx-org/gtkx): Source code, examples, issue tracker
- [GTK4 Documentation](https://docs.gtk.org/gtk4/): Official GTK4 widget reference and concepts
- [Libadwaita Documentation](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/): Official Libadwaita component reference
- [GNOME Human Interface Guidelines](https://developer.gnome.org/hig/): Design patterns and UX guidelines for GNOME apps
`,
            }),
        ],
    },
    head: [
        ["link", { rel: "icon", href: "/favicon.svg" }],
        ["meta", { property: "og:type", content: "website" }],
        ["meta", { property: "og:site_name", content: "GTKX" }],
        ["meta", { property: "og:title", content: SITE_TITLE }],
        ["meta", { property: "og:description", content: SITE_DESCRIPTION }],
        ["meta", { property: "og:image", content: `${SITE_URL}/og/og-home.png` }],
        ["meta", { property: "og:image:width", content: "1200" }],
        ["meta", { property: "og:image:height", content: "630" }],
        ["meta", { name: "twitter:card", content: "summary_large_image" }],
        ["meta", { name: "twitter:title", content: SITE_TITLE }],
        ["meta", { name: "twitter:description", content: SITE_DESCRIPTION }],
        ["meta", { name: "twitter:image", content: `${SITE_URL}/og/og-home.png` }],
        ["meta", { name: "theme-color", content: "#c8102e" }],
        [
            "script",
            { id: "default-light-appearance" },
            "try{if(!localStorage.getItem('vitepress-theme-appearance'))localStorage.setItem('vitepress-theme-appearance','light')}catch(e){}",
        ],
    ],
    transformPageData(pageData) {
        const canonical = `${SITE_URL}/${pageData.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "")}`;
        const head: HeadConfig[] = [
            ["link", { rel: "canonical", href: canonical }],
            ["meta", { property: "og:url", content: canonical }],
        ];
        pageData.frontmatter.head = [...(pageData.frontmatter.head ?? []), ...head];
    },
    markdown: {
        theme: { light: "one-dark-pro", dark: "one-dark-pro" },
    },
    themeConfig: {
        logo: "/logo.svg",
        nav: [
            {
                text: "Docs",
                link: "/docs/introduction",
                activeMatch: "^/docs/(?!tutorial|gallery|changelog)",
            },
            {
                text: "Tutorial",
                link: "/docs/tutorial/1-window-and-header-bar",
                activeMatch: "^/docs/tutorial/",
            },
            {
                text: "Gallery",
                link: "/docs/gallery/",
                activeMatch: "^/docs/gallery/",
            },
            {
                text: "API",
                link: "/api/react/",
                activeMatch: "^/api/",
            },
            {
                text: "Changelog",
                link: "/docs/changelog",
                activeMatch: "^/docs/changelog",
            },
        ],
        socialLinks: [{ icon: "github", link: "https://github.com/gtkx-org/gtkx" }],
        sidebar: {
            "/docs/": [
                {
                    text: "Introduction",
                    collapsed: false,
                    items: [
                        { text: "What is GTKX?", link: "/docs/introduction" },
                        { text: "Getting started", link: "/docs/getting-started" },
                        { text: "Thinking in GTKX", link: "/docs/thinking-in-gtkx" },
                    ],
                },
                {
                    text: "Tutorial: Building a notes app",
                    collapsed: false,
                    items: [
                        { text: "1. Window & header bar", link: "/docs/tutorial/1-window-and-header-bar" },
                        { text: "2. Styling with CSS-in-JS", link: "/docs/tutorial/2-styling" },
                        { text: "3. Lists & data", link: "/docs/tutorial/3-lists" },
                        { text: "4. Menus & shortcuts", link: "/docs/tutorial/4-menus-and-shortcuts" },
                        { text: "5. Navigation & split views", link: "/docs/tutorial/5-navigation" },
                        { text: "6. Dialogs & animations", link: "/docs/tutorial/6-dialogs-and-animations" },
                        { text: "7. Settings & preferences", link: "/docs/tutorial/7-settings-and-preferences" },
                        { text: "8. Deploying", link: "/docs/tutorial/8-deploying" },
                    ],
                },
                {
                    text: "Guides",
                    collapsed: false,
                    items: [
                        { text: "Windows & application lifecycle", link: "/docs/guides/windows" },
                        { text: "Hooks", link: "/docs/guides/hooks" },
                        { text: "Lists & tables", link: "/docs/guides/lists" },
                        { text: "Menus, actions & shortcuts", link: "/docs/guides/menus-and-actions" },
                        { text: "Dialogs", link: "/docs/guides/dialogs" },
                        { text: "Styling and CSS", link: "/docs/styling" },
                        { text: "Portals", link: "/docs/portals" },
                        { text: "OpenGL", link: "/docs/guides/opengl" },
                        { text: "Testing", link: "/docs/testing" },
                    ],
                },
                {
                    text: "Widget gallery",
                    collapsed: true,
                    items: [
                        { text: "Overview", link: "/docs/gallery/" },
                        { text: "Layout & containers", link: "/docs/gallery/layout" },
                        { text: "Controls & input", link: "/docs/gallery/controls" },
                        { text: "Lists, tables & navigation", link: "/docs/gallery/lists-navigation" },
                        { text: "Adwaita & feedback", link: "/docs/gallery/adwaita" },
                    ],
                },
                {
                    text: "Concepts",
                    collapsed: true,
                    items: [{ text: "Architecture & FFI bindings", link: "/docs/ffi-bindings" }],
                },
                {
                    text: "Reference",
                    collapsed: true,
                    items: [
                        { text: "CLI", link: "/docs/cli" },
                        { text: "Configuration", link: "/docs/config" },
                        { text: "MCP", link: "/docs/mcp" },
                        { text: "Changelog", link: "/docs/changelog" },
                    ],
                },
            ],
            "/api/": [
                {
                    text: "@gtkx/react",
                    link: "/api/react/",
                    collapsed: false,
                    items: prepareTypedocSidebar(reactSidebar as DefaultTheme.SidebarItem[]),
                },
                {
                    text: "@gtkx/animate",
                    link: "/api/animate/",
                    collapsed: true,
                    items: prepareTypedocSidebar(animateSidebar as DefaultTheme.SidebarItem[]),
                },
                {
                    text: "@gtkx/css",
                    link: "/api/css/",
                    collapsed: true,
                    items: prepareTypedocSidebar(cssSidebar as DefaultTheme.SidebarItem[]),
                },
                {
                    text: "@gtkx/testing",
                    link: "/api/testing/",
                    collapsed: true,
                    items: prepareTypedocSidebar(testingSidebar as DefaultTheme.SidebarItem[]),
                },
                {
                    text: "@gtkx/ffi",
                    link: "/api/ffi/",
                    collapsed: true,
                    items: prepareTypedocSidebar(ffiSidebar as DefaultTheme.SidebarItem[]),
                },
            ],
        },
        search: {
            provider: "local",
        },
        editLink: {
            pattern: "https://github.com/gtkx-org/gtkx/edit/main/website/:path",
        },
    },
});
