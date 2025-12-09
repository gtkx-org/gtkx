import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
    docsSidebar: [
        "introduction",
        "getting-started",
        {
            type: "category",
            label: "Guides",
            items: [
                "guides/cli",
                "guides/slots",
                "guides/lists",
                "guides/dialogs",
                "guides/portals",
                "guides/grid-layout",
                "guides/styling",
                "guides/menus",
                "guides/testing",
            ],
        },
    ],
    apiSidebar: [
        {
            type: "category",
            label: "@gtkx/react",
            link: {
                type: "doc",
                id: "api/react/index",
            },
            items: require("./docs/api/react/typedoc-sidebar.cjs"),
        },
        {
            type: "category",
            label: "@gtkx/css",
            link: {
                type: "doc",
                id: "api/css/index",
            },
            items: require("./docs/api/css/typedoc-sidebar.cjs"),
        },
        {
            type: "category",
            label: "@gtkx/testing",
            link: {
                type: "doc",
                id: "api/testing/index",
            },
            items: require("./docs/api/testing/typedoc-sidebar.cjs"),
        },
        {
            type: "category",
            label: "@gtkx/ffi",
            link: {
                type: "doc",
                id: "api/ffi/index",
            },
            items: require("./docs/api/ffi/typedoc-sidebar.cjs"),
        },
    ],
};

export default sidebars;
