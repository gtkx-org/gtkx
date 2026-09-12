import manifest from "../versions.json" with { type: "json" };

type DocumentationItem = {
    text: string;
    path: string;
};

type VersionStatus = "current" | "prerelease" | "old";

type ReferenceSource = { source: "worktree" } | { source: "tag"; tag: string; commit: string };

type DocumentationVersion = {
    id: string;
    label: string;
    prefix: string;
    status: VersionStatus;
    examplesRef: string;
    reference: ReferenceSource;
};

type VersionPageLookup = (version: DocumentationVersion, path: string) => boolean;

const GUIDE_ROOT = "guide/why-gtkx";
const TUTORIAL_ROOT = "tutorial/";
const REFERENCE_ROOT = "reference/";

const guideItems: DocumentationItem[] = [
    { text: "Why GTKX", path: GUIDE_ROOT },
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
    { text: "Introduction", path: TUTORIAL_ROOT },
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

const documentationItems: DocumentationItem[] = [...guideItems, ...tutorialItems];

const STATUSES: ReadonlySet<string> = new Set<VersionStatus>(["current", "prerelease", "old"]);

const isVersionStatus = (value: string): value is VersionStatus => STATUSES.has(value);

const toStatus = (value: string): VersionStatus => {
    if (isVersionStatus(value)) {
        return value;
    }

    throw new Error(`versions.json declares the unknown status "${value}".`);
};

const toPrefix = (value: string): string => {
    if (value === "" || /^\/[A-Za-z0-9][A-Za-z0-9.-]*$/.test(value)) {
        return value;
    }

    throw new Error(`versions.json declares the invalid prefix "${value}".`);
};

const toReference = (reference: { source: string; tag: string; commit: string }): ReferenceSource => {
    if (reference.source === "worktree") {
        return { source: "worktree" };
    }

    if (reference.source === "tag" && reference.tag !== "" && reference.commit !== "") {
        return { source: "tag", tag: reference.tag, commit: reference.commit };
    }

    throw new Error(`versions.json declares an unusable reference source "${reference.source}".`);
};

const assertUnique = (values: string[], field: string): void => {
    if (new Set(values).size !== values.length) {
        throw new Error(`versions.json declares a duplicate ${field}.`);
    }
};

const assertExactlyOne = (matches: readonly DocumentationVersion[], description: string): void => {
    if (matches.length !== 1) {
        throw new Error(`versions.json must declare exactly one ${description}, found ${String(matches.length)}.`);
    }
};

const assertAtMostOne = (matches: readonly DocumentationVersion[], description: string): void => {
    if (matches.length > 1) {
        throw new Error(`versions.json must declare at most one ${description}, found ${String(matches.length)}.`);
    }
};

const readVersions = (): readonly DocumentationVersion[] => {
    const parsed = manifest.versions.map((version) => ({
        id: version.id,
        label: version.label,
        prefix: toPrefix(version.prefix),
        status: toStatus(version.status),
        examplesRef: version.examplesRef,
        reference: toReference(version.reference),
    }));

    assertUnique(
        parsed.map((version) => version.id),
        "version id",
    );
    assertUnique(
        parsed.map((version) => version.prefix),
        "version prefix",
    );
    assertExactlyOne(
        parsed.filter((version) => version.status === "current" && version.prefix === ""),
        "current version served without a prefix",
    );
    assertExactlyOne(
        parsed.filter((version) => version.prefix === ""),
        "version served without a prefix",
    );
    assertExactlyOne(
        parsed.filter((version) => version.reference.source === "worktree"),
        "version whose reference is built from the working tree",
    );
    assertAtMostOne(
        parsed.filter((version) => version.status === "prerelease"),
        "pre-release version",
    );
    assertAtMostOne(
        parsed.filter((version) => version.status === "old"),
        "superseded version",
    );

    return parsed;
};

const versions = readVersions();

const retentionPolicy: string = manifest.retention;

const findVersion = (isMatch: (version: DocumentationVersion) => boolean): DocumentationVersion => {
    const found = versions.find((version) => isMatch(version));

    if (!found) {
        throw new Error("versions.json must declare a version matching the requested criteria.");
    }

    return found;
};

const currentVersion = findVersion((version) => version.status === "current" && version.prefix === "");

const rootVersion = currentVersion;

const featuredVersion = versions.find((version) => version.status === "prerelease") ?? currentVersion;

const versionById = (id: string): DocumentationVersion => findVersion((version) => version.id === id);

const documentationLink = (version: DocumentationVersion, path: string): string => `${version.prefix}/${path}`;

const isVersionPath = (pathname: string, version: DocumentationVersion): boolean =>
    version.prefix !== "" && (pathname === version.prefix || pathname.startsWith(`${version.prefix}/`));

const versionForPath = (path: string): DocumentationVersion => {
    const pathname = path.split(/[?#]/, 1)[0] ?? "";

    return versions.find((version) => isVersionPath(pathname, version)) ?? rootVersion;
};

const normalizeDocumentationPath = (path: string): string => {
    const pathname = path.split(/[?#]/, 1)[0] ?? "";
    const version = versionForPath(pathname);
    const withoutPrefix = version.prefix === "" ? pathname : pathname.slice(version.prefix.length);

    return withoutPrefix
        .replace(/^\/+/, "")
        .replace(/\/index(?:\.html)?$/, "/")
        .replace(/\.html$/, "");
};

const sectionRoot = (path: string): string | undefined => {
    if (path.startsWith(TUTORIAL_ROOT)) {
        return TUTORIAL_ROOT;
    }

    return path.startsWith(REFERENCE_ROOT) ? REFERENCE_ROOT : undefined;
};

const counterpartPath = (
    path: string,
    target: DocumentationVersion,
    hasPage: VersionPageLookup,
): string | undefined => {
    if (hasPage(target, path)) {
        return path;
    }

    const root = sectionRoot(path);

    return root !== undefined && hasPage(target, root) ? root : undefined;
};

const resolveVersionPath = (currentPath: string, target: DocumentationVersion, hasPage: VersionPageLookup): string => {
    const path = normalizeDocumentationPath(currentPath);

    return documentationLink(target, counterpartPath(path, target, hasPage) ?? GUIDE_ROOT);
};

export {
    currentVersion,
    type DocumentationItem,
    documentationItems,
    documentationLink,
    type DocumentationVersion,
    featuredVersion,
    GUIDE_ROOT,
    guideItems,
    normalizeDocumentationPath,
    REFERENCE_ROOT,
    resolveVersionPath,
    retentionPolicy,
    rootVersion,
    TUTORIAL_ROOT,
    tutorialItems,
    versionById,
    versionForPath,
    versions,
};
