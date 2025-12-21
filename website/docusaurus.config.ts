import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
    title: "GTKX",
    tagline: "Build native GTK4 desktop applications with React and TypeScript",
    favicon: "img/favicon.svg",

    url: "https://eugeniodepalo.github.io",
    baseUrl: "/gtkx/",

    organizationName: "eugeniodepalo",
    projectName: "gtkx",

    onBrokenLinks: "throw",
    onBrokenAnchors: "ignore",

    markdown: {
        hooks: {
            onBrokenMarkdownLinks: "warn",
        },
    },

    i18n: {
        defaultLocale: "en",
        locales: ["en"],
    },

    presets: [
        [
            "classic",
            {
                docs: {
                    sidebarPath: "./sidebars.ts",
                    editUrl: "https://github.com/eugeniodepalo/gtkx/tree/main/website/",
                },
                blog: false,
                theme: {
                    customCss: "./src/css/custom.css",
                },
            } satisfies Preset.Options,
        ],
    ],

    plugins: [
        [
            "docusaurus-plugin-typedoc",
            {
                id: "api-react",
                entryPoints: ["../packages/react/src/index.ts"],
                tsconfig: "../packages/react/tsconfig.lib.json",
                out: "docs/api/react",
                readme: "none",
                indexFormat: "table",
                parametersFormat: "table",
                enumMembersFormat: "table",
                typeDeclarationFormat: "table",
                groupOrder: ["Functions", "Variables", "Interfaces", "*"],
            },
        ],
        [
            "docusaurus-plugin-typedoc",
            {
                id: "api-css",
                entryPoints: ["../packages/css/src/index.ts"],
                tsconfig: "../packages/css/tsconfig.lib.json",
                out: "docs/api/css",
                readme: "none",
                indexFormat: "table",
                parametersFormat: "table",
                enumMembersFormat: "table",
                typeDeclarationFormat: "table",
                groupOrder: ["Functions", "Variables", "Interfaces", "*"],
            },
        ],
        [
            "docusaurus-plugin-typedoc",
            {
                id: "api-testing",
                entryPoints: ["../packages/testing/src/index.ts"],
                tsconfig: "../packages/testing/tsconfig.lib.json",
                out: "docs/api/testing",
                readme: "none",
                indexFormat: "table",
                parametersFormat: "table",
                enumMembersFormat: "table",
                typeDeclarationFormat: "table",
                groupOrder: ["Functions", "Variables", "Interfaces", "*"],
            },
        ],
        [
            "docusaurus-plugin-typedoc",
            {
                id: "api-ffi",
                entryPoints: ["../packages/ffi/src/index.ts"],
                tsconfig: "../packages/ffi/tsconfig.lib.json",
                out: "docs/api/ffi",
                readme: "none",
                indexFormat: "table",
                parametersFormat: "table",
                enumMembersFormat: "table",
                typeDeclarationFormat: "table",
                groupOrder: ["Functions", "Variables", "Interfaces", "*"],
            },
        ],
    ],

    themeConfig: {
        image: "img/social-card.png",
        navbar: {
            title: "GTKX",
            logo: {
                alt: "GTKX Logo",
                src: "img/logo.svg",
            },
            items: [
                {
                    type: "docSidebar",
                    sidebarId: "docsSidebar",
                    position: "left",
                    label: "Docs",
                },
                {
                    type: "docSidebar",
                    sidebarId: "apiSidebar",
                    position: "left",
                    label: "API",
                },
                {
                    href: "https://github.com/eugeniodepalo/gtkx",
                    label: "GitHub",
                    position: "right",
                },
            ],
        },
        footer: {
            style: "dark",
            links: [
                {
                    title: "Docs",
                    items: [
                        {
                            label: "Introduction",
                            to: "/docs/introduction",
                        },
                        {
                            label: "Getting Started",
                            to: "/docs/getting-started",
                        },
                    ],
                },
                {
                    title: "API Reference",
                    items: [
                        {
                            label: "@gtkx/react",
                            to: "/docs/api/react",
                        },
                        {
                            label: "@gtkx/css",
                            to: "/docs/api/css",
                        },
                        {
                            label: "@gtkx/testing",
                            to: "/docs/api/testing",
                        },
                        {
                            label: "@gtkx/ffi",
                            to: "/docs/api/ffi",
                        },
                    ],
                },
                {
                    title: "More",
                    items: [
                        {
                            label: "GitHub",
                            href: "https://github.com/eugeniodepalo/gtkx",
                        },
                        {
                            label: "llms.txt",
                            href: "https://eugeniodepalo.github.io/gtkx/llms.txt",
                        },
                    ],
                },
            ],
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
