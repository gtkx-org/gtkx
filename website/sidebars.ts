import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";
import typedocSidebar from "./docs/api/typedoc-sidebar.cjs";

const sidebars: SidebarsConfig = {
    docsSidebar: [
        "introduction",
        "getting-started",
        {
            type: "category",
            label: "Guides",
            items: ["guides/components", "guides/events", "guides/dialogs", "guides/lists", "guides/styling", "guides/error-handling"],
        },
        "architecture",
        "contributing",
    ],
    apiSidebar: [{ type: "doc", id: "api/index", label: "API Reference" }, ...typedocSidebar],
};

export default sidebars;
