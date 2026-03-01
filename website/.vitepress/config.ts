import { defineConfig } from "vitepress";

export default defineConfig({
    title: "GTKX",
    description: "Linux application development for the modern age powered by GTK4 and React",
    appearance: "force-dark",
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
                        { text: "Slots and Container Slots", link: "/docs/slots" },
                        { text: "Portals", link: "/docs/portals" },
                        { text: "Testing", link: "/docs/testing" },
                        {
                            text: "x.* Elements",
                            link: "/docs/x-elements",
                        },
                    ],
                },
                {
                    text: "Advanced Guides",
                    collapsed: true,
                    items: [
                        { text: "Lists", link: "/docs/lists" },
                        { text: "Menus", link: "/docs/menus" },
                        { text: "Animations", link: "/docs/animations" },
                        { text: "Adwaita", link: "/docs/adwaita" },
                        { text: "CLI", link: "/docs/cli" },
                        { text: "MCP", link: "/docs/mcp" },
                        { text: "Deploying", link: "/docs/deploying" },
                    ],
                },
            ],
            "/api/": [
                {
                    text: "@gtkx/react",
                    link: "/api/react/",
                },
                {
                    text: "@gtkx/css",
                    link: "/api/css/",
                },
                {
                    text: "@gtkx/testing",
                    link: "/api/testing/",
                },
                {
                    text: "@gtkx/ffi",
                    link: "/api/ffi/",
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
