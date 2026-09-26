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
    aliases: string[];
    status: VersionStatus;
    examplesRef: string;
    reference: ReferenceSource;
};

type VersionLink = {
    href: string;
    samePage: boolean;
};

type VersionPageLookup = (version: DocumentationVersion, path: string) => boolean;

const GUIDE_ROOT = "guide/why-gtkx";
const TUTORIAL_ROOT = "tutorial/";
const REFERENCE_ROOT = "reference/";

const guideItems: DocumentationItem[] = [
    { text: "Why GTKX", path: GUIDE_ROOT },
    { text: "Getting Started", path: "guide/getting-started" },
    { text: "Configuration and Codegen", path: "guide/configuration-and-codegen" },
    { text: "Scaffold Options", path: "guide/scaffold-options" },
    { text: "Assets and Build Output", path: "guide/assets" },
    { text: "Native Values", path: "guide/native-values" },
    { text: "Async Operations", path: "guide/async-operations" },
    { text: "Workers and Helper Processes", path: "guide/workers" },
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
    { text: "Storybook", path: "guide/storybook" },
    { text: "MCP", path: "guide/mcp" },
    { text: "Deploying", path: "guide/deploying" },
    { text: "Upgrading to 2.0", path: "guide/upgrading-to-2" },
];

const tutorialItems: DocumentationItem[] = [
    { text: "Introduction", path: TUTORIAL_ROOT },
    { text: "Create a Window", path: "tutorial/your-first-window" },
    { text: "Display Tasks", path: "tutorial/a-list-of-tasks" },
    { text: "Add Tasks", path: "tutorial/the-task-store" },
    { text: "Complete, Star, and Delete Tasks", path: "tutorial/completing-and-deleting" },
    { text: "Save Tasks", path: "tutorial/saving-to-disk" },
    { text: "Add Lists and a Sidebar", path: "tutorial/lists-and-the-sidebar" },
    { text: "Adapt the Layout", path: "tutorial/an-adaptive-layout" },
    { text: "Filter and Search Tasks", path: "tutorial/smart-views-and-search" },
    { text: "Edit Tasks", path: "tutorial/the-task-editor" },
    { text: "Add Menus and Shortcuts", path: "tutorial/actions-menus-shortcuts" },
    { text: "Add Undo and Delete Confirmation", path: "tutorial/trash-and-toasts" },
    { text: "Add Preferences", path: "tutorial/preferences-and-theming" },
    { text: "Reorder Tasks", path: "tutorial/drag-to-reorder" },
    { text: "Send Reminders", path: "tutorial/reminders" },
    { text: "Test the App", path: "tutorial/testing" },
    { text: "Package the App", path: "tutorial/packaging" },
    { text: "Translate the App", path: "tutorial/internationalization" },
    { text: "Prepare for Flathub", path: "tutorial/flatpak" },
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

const toAliases = (value: unknown): string[] => {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new TypeError("Documentation aliases must be an array of prefixes.");
    }

    return value.map((alias: unknown) => {
        if (typeof alias !== "string" || alias === "") {
            throw new TypeError("Documentation aliases must be nonempty prefixes.");
        }

        return toPrefix(alias);
    });
};

const versionLabel = (version: string): string => {
    const at = version.indexOf("-");
    const core = at === -1 ? version : version.slice(0, at);
    const prerelease = at === -1 ? "" : version.slice(at + 1);
    const [major = "0", minor = "0"] = core.split(".", 2);
    const base = `${major}.${minor}`;

    return prerelease ? `${base} ${prerelease.replaceAll(".", " ")}` : `${base} stable`;
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

const assertAvailablePrefixes = (entries: readonly DocumentationVersion[]): void => {
    const reserved = new Set(["guide", "tutorial", "reference", "contributing", "blog", "assets", "fonts"]);
    const prefixes = entries.flatMap((version) => [version.prefix, ...version.aliases]);
    if (prefixes.some((prefix) => reserved.has(prefix.slice(1)))) {
        throw new Error("A documentation prefix or alias collides with a site directory.");
    }
};

const packageVersion = manifest.packageVersion;

const readVersions = (): readonly DocumentationVersion[] => {
    if (packageVersion === "") {
        throw new Error("versions.json must declare the packageVersion the working-tree label derives from.");
    }

    const parsed = manifest.versions.map((version) => {
        const reference = toReference(version.reference);

        return {
            id: version.id,
            label: reference.source === "worktree" ? versionLabel(packageVersion) : version.label,
            prefix: toPrefix(version.prefix),
            aliases: toAliases("aliases" in version ? version.aliases : undefined),
            status: toStatus(version.status),
            examplesRef: version.examplesRef,
            reference,
        };
    });

    assertUnique(parsed.map((version) => version.id), "version id");
    assertUnique(
        parsed.flatMap((version) => [version.prefix, ...version.aliases]),
        "version prefix or alias",
    );
    assertAvailablePrefixes(parsed);
    assertExactlyOne(
        parsed.filter((version) => version.status === "current"),
        "current version",
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

const isDocumentationPath = (path: string): boolean => {
    const pathname = path.startsWith("/") ? path : `/${path}`;

    return /^(guide|tutorial|reference)\//.test(normalizeDocumentationPath(pathname));
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
    isDocumentationPath,
    normalizeDocumentationPath,
    REFERENCE_ROOT,
    resolveVersionPath,
    retentionPolicy,
    rootVersion,
    TUTORIAL_ROOT,
    tutorialItems,
    versionById,
    versionForPath,
    type VersionLink,
    versions,
};
