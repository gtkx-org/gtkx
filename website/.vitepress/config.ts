import { type DefaultTheme, defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import cssSidebar from "../api/css/typedoc-sidebar.json" with { type: "json" };
import ffiSidebar from "../api/ffi/typedoc-sidebar.json" with { type: "json" };
import reactSidebar from "../api/react/typedoc-sidebar.json" with { type: "json" };
import testingSidebar from "../api/testing/typedoc-sidebar.json" with { type: "json" };

const prepareTypedocSidebar = (items: DefaultTheme.SidebarItem[]): DefaultTheme.SidebarItem[] =>
    items.map((item) => {
        const link = item.link?.replace(/^\/website/, "").replace(/\.md$/, "");
        const children = item.items ? prepareTypedocSidebar(item.items) : undefined;
        return { ...item, ...(link ? { link } : {}), ...(children ? { items: children } : {}) };
    });

export default defineConfig({
    title: "GTKX",
    description: "Linux application development for the modern age powered by GTK4 and React",
    appearance: "force-dark",
    vite: {
        plugins: [
            llmstxt({
                domain: "https://gtkx.dev",
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
    head: [["link", { rel: "icon", href: "/favicon.svg" }]],
    themeConfig: {
        logo: "/logo.svg",
        nav: [
            {
                text: "Docs",
                link: "/docs/introduction",
                activeMatch: "^/docs/",
            },
            {
                text: "API",
                link: "/api/react/",
                activeMatch: "^/api/",
            },
        ],
        socialLinks: [{ icon: "github", link: "https://github.com/gtkx-org/gtkx" }],
        sidebar: {
            "/docs/": [
                {
                    text: "Introduction",
                    link: "/docs/introduction",
                },
                {
                    text: "Getting Started",
                    link: "/docs/getting-started",
                },
                {
                    text: "Core Concepts",
                    collapsed: false,
                    items: [
                        { text: "FFI Bindings", link: "/docs/ffi-bindings" },
                        { text: "Styling and CSS", link: "/docs/styling" },
                        { text: "Portals", link: "/docs/portals" },
                        { text: "Testing", link: "/docs/testing" },
                    ],
                },
                {
                    text: "Tutorial: Building a Notes App",
                    collapsed: false,
                    items: [
                        { text: "1. Window & Header Bar", link: "/docs/tutorial/1-window-and-header-bar" },
                        { text: "2. Styling with CSS-in-JS", link: "/docs/tutorial/2-styling" },
                        { text: "3. Lists & Data", link: "/docs/tutorial/3-lists" },
                        { text: "4. Menus & Shortcuts", link: "/docs/tutorial/4-menus-and-shortcuts" },
                        { text: "5. Navigation & Split Views", link: "/docs/tutorial/5-navigation" },
                        { text: "6. Dialogs & Animations", link: "/docs/tutorial/6-dialogs-and-animations" },
                        { text: "7. Settings & Preferences", link: "/docs/tutorial/7-settings-and-preferences" },
                        { text: "8. Deploying", link: "/docs/tutorial/8-deploying" },
                    ],
                },
                {
                    text: "Reference",
                    collapsed: true,
                    items: [
                        { text: "CLI", link: "/docs/cli" },
                        { text: "MCP", link: "/docs/mcp" },
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
        footer: {
            message: '<img src="/logo.svg" alt="GTKX" class="footer-logo">',
            copyright: `Copyright \u00A9 ${new Date().getFullYear()} the GTKX team`,
        },
    },
});
