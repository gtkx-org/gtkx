import { defineConfig } from "vitepress";

const title = "GTKX";
const description =
    "Linux desktop application development for the modern age. Write declarative JSX; GTKX renders real native GTK4 and libadwaita widgets — no webview, no Electron.";
const url = "https://gtkx.dev";
const ogImage = `${url}/og.png`;

export default defineConfig({
    title,
    description,
    lang: "en",
    appearance: "dark",
    cleanUrls: true,
    lastUpdated: false,
    vite: {
        server: {
            allowedHosts: ["workstation"],
        },
    },

    head: [
        ["link", { rel: "icon", type: "image/svg+xml", href: "/gtkx-mark.svg" }],
        ["meta", { name: "theme-color", content: "#e03a3e" }],
        ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
        ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
        [
            "link",
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=Red+Hat+Display:ital,wght@0,300..900;1,300..900&family=Red+Hat+Text:ital,wght@0,300..700;1,300..700&family=Red+Hat+Mono:ital,wght@0,300..700;1,300..700&display=swap",
            },
        ],
        ["meta", { property: "og:type", content: "website" }],
        ["meta", { property: "og:site_name", content: title }],
        ["meta", { property: "og:title", content: `${title} — ${description}` }],
        ["meta", { property: "og:description", content: description }],
        ["meta", { property: "og:url", content: url }],
        ["meta", { property: "og:image", content: ogImage }],
        ["meta", { name: "twitter:card", content: "summary_large_image" }],
        ["meta", { name: "twitter:title", content: title }],
        ["meta", { name: "twitter:description", content: description }],
        ["meta", { name: "twitter:image", content: ogImage }],
    ],

    themeConfig: {
        siteTitle: title,
        logo: "/gtkx-mark.svg",
        nav: [
            { text: "Guide", link: "/guide/" },
            { text: "Examples", link: "https://github.com/gtkx-org/gtkx/tree/main/examples" },
        ],
        sidebar: {
            "/guide/": [
                {
                    text: "Tutorial: Tasks App",
                    items: [
                        { text: "Introduction", link: "/guide/" },
                        { text: "Getting Started", link: "/guide/getting-started" },
                        { text: "The Application Shell", link: "/guide/app-shell" },
                        { text: "Data Model and Persistence", link: "/guide/data-and-persistence" },
                        { text: "The Sidebar", link: "/guide/the-sidebar" },
                        { text: "The Task List", link: "/guide/the-task-list" },
                        { text: "Task Rows and Drag-to-Reorder", link: "/guide/task-rows-and-reordering" },
                        { text: "The Task Editor", link: "/guide/the-task-editor" },
                        { text: "Actions, Menus, and Shortcuts", link: "/guide/actions-menus-shortcuts" },
                        { text: "Selection Mode", link: "/guide/selection-and-batch" },
                        { text: "Preferences and Theming", link: "/guide/preferences-and-theming" },
                        { text: "Reminders and Notifications", link: "/guide/notifications" },
                        { text: "Feedback and Dialogs", link: "/guide/feedback-and-dialogs" },
                        { text: "Testing the App", link: "/guide/testing" },
                        { text: "Packaging and Shipping", link: "/guide/packaging" },
                    ],
                },
            ],
        },
        socialLinks: [{ icon: "github", link: "https://github.com/gtkx-org/gtkx" }],
        editLink: {
            pattern: "https://github.com/gtkx-org/gtkx/edit/main/website/:path",
            text: "Edit this page on GitHub",
        },
    },
});
