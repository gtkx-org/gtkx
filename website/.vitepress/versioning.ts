type DocumentationVersion = "stable" | "beta";

type DocumentationItem = {
    text: string;
    path: string;
};

const guideItems: DocumentationItem[] = [
    { text: "Why GTKX", path: "guide/why-gtkx" },
    { text: "Getting Started", path: "guide/getting-started" },
    { text: "Configuration and Codegen", path: "guide/configuration-and-codegen" },
    { text: "Async Operations", path: "guide/async-operations" },
    { text: "Error Handling", path: "guide/error-handling" },
    { text: "Subclassing GObject", path: "guide/subclassing" },
    { text: "Components", path: "guide/components" },
    { text: "Forms", path: "guide/forms" },
    { text: "Modals and Portals", path: "guide/modals-and-portals" },
    { text: "Navigation", path: "guide/navigation" },
    { text: "CSS", path: "guide/css" },
    { text: "Animations", path: "guide/animations" },
    { text: "Cairo", path: "guide/cairo" },
    { text: "OpenGL", path: "guide/opengl" },
    { text: "Internationalization", path: "guide/internationalization" },
    { text: "Testing", path: "guide/testing" },
    { text: "MCP", path: "guide/mcp" },
    { text: "Deploying", path: "guide/deploying" },
    { text: "Upgrading to 2.0", path: "guide/upgrading-to-2" },
];

const tutorialItems: DocumentationItem[] = [
    { text: "Introduction", path: "tutorial/" },
    { text: "Your First Window", path: "tutorial/your-first-window" },
    { text: "A List of Tasks", path: "tutorial/a-list-of-tasks" },
    { text: "The Task Store", path: "tutorial/the-task-store" },
    { text: "Interactive Rows", path: "tutorial/completing-and-deleting" },
    { text: "Saving to Disk", path: "tutorial/saving-to-disk" },
    { text: "Lists and the Sidebar", path: "tutorial/lists-and-the-sidebar" },
    { text: "Adaptive Layout", path: "tutorial/an-adaptive-layout" },
    { text: "Smart Views and Search", path: "tutorial/smart-views-and-search" },
    { text: "The Task Editor", path: "tutorial/the-task-editor" },
    { text: "Actions and Menus", path: "tutorial/actions-menus-shortcuts" },
    { text: "Trash and Toasts", path: "tutorial/trash-and-toasts" },
    { text: "Preferences and Theming", path: "tutorial/preferences-and-theming" },
    { text: "Drag to Reorder", path: "tutorial/drag-to-reorder" },
    { text: "Reminders", path: "tutorial/reminders" },
    { text: "Appendix A: Testing", path: "tutorial/testing" },
    { text: "Appendix B: Packaging", path: "tutorial/packaging" },
    { text: "Internationalization", path: "tutorial/internationalization" },
    { text: "Appendix C: Flathub", path: "tutorial/flatpak" },
];

const versionPrefix = (version: DocumentationVersion): string => (version === "beta" ? "/v2" : "");

const documentationLink = (version: DocumentationVersion, path: string): string =>
    `${versionPrefix(version)}/${path}`;

const documentationVersionForPath = (path: string): DocumentationVersion =>
    path === "/v2" || path.startsWith("/v2/") ? "beta" : "stable";

const normalizeDocumentationPath = (path: string): string => {
    const pathname = path.split(/[?#]/, 1)[0] ?? "";

    return pathname
        .replace(/^\/+/, "")
        .replace(/^v2\//, "")
        .replace(/\/index(?:\.html)?$/, "/")
        .replace(/\.html$/, "");
};

const counterpartPaths = new Set([...guideItems, ...tutorialItems].map((item) => item.path));

const hasVersionCounterpart = (path: string): boolean => {
    const documentationPath = normalizeDocumentationPath(path);

    return counterpartPaths.has(documentationPath) || documentationPath === "reference/";
};

const resolveVersionPath = (currentPath: string, targetVersion: DocumentationVersion): string => {
    const path = normalizeDocumentationPath(currentPath);

    if (counterpartPaths.has(path)) {
        return documentationLink(targetVersion, path);
    }

    if (path === "reference/") {
        return documentationLink(targetVersion, path);
    }

    if (path.startsWith("tutorial/")) {
        return documentationLink(targetVersion, "tutorial/");
    }

    if (path.startsWith("reference/")) {
        return documentationLink(targetVersion, "reference/");
    }

    return documentationLink(targetVersion, "guide/why-gtkx");
};

export {
    documentationLink,
    type DocumentationItem,
    type DocumentationVersion,
    documentationVersionForPath,
    guideItems,
    hasVersionCounterpart,
    resolveVersionPath,
    tutorialItems,
    versionPrefix,
};
