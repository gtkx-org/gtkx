import type { Config } from "@gtkx/config";

type DeployConfig = NonNullable<Config["deploy"]>;
type DeployTargetName = NonNullable<DeployConfig["targets"]>[number];
type PackageFamily = "arch" | "debian" | "fedora" | "suse" | "unknown";

type DeployTool = {
    command: string;
    purpose: string;
    isOptional: boolean;
    isPresent?: () => boolean;
};

type StagedFile = {
    rel: string;
    abs: string;
    mode: number;
};

type NodeRuntime = {
    path: string;
    version: string;
    glibcFloor: string | null;
    isStripped: boolean;
};

type DeployDeveloper = {
    id: string | null;
    name: string;
    email: string | null;
};

type DeployScreenshot = {
    url: string;
    caption: string | null;
    isDefault: boolean;
};

type DeployRelease = {
    version: string;
    date: string;
    type: string | null;
    urgency: string | null;
    notes: string[];
    url: string | null;
};

type DeployFileAssociation = {
    extension: string;
    mimeType: string;
    description: string | null;
};

type DeployDesktopAction = {
    id: string;
    name: string;
    args: string[];
    icon: string | null;
};

type DeployVersions = {
    upstream: string;
    packageVersion: string;
    debRevision: string;
    rpmRelease: string;
    epoch: number | null;
};

type DeployArch = {
    deb: string;
    rpm: string;
    flatpak: string;
    appimage: string;
    node: string;
};

type DeployPaths = {
    root: string;
    dist: string;
    outDir: string;
    metadata: string;
    runtime: string;
    stage: string;
    overlay: string;
    targets: string;
    output: string;
    dataDir: string | null;
    iconsDir: string | null;
    iconFile: string | null;
    licenseFile: string | null;
    schemaFiles: string[];
};

type DeploySettings = {
    applicationId: string;
    binaryName: string;
    name: string;
    genericName: string | null;
    summary: string;
    description: string[];
    keywords: string[];
    categories: string[];
    mimeTypes: string[];
    developer: DeployDeveloper;
    license: string;
    metadataLicense: string;
    copyright: string;
    homepage: string | null;
    urls: Record<string, string>;
    screenshots: DeployScreenshot[];
    branding: { light: string; dark: string } | null;
    contentRating: Record<string, string>;
    releases: DeployRelease[];
    execArgs: string[];
    execToken: string | null;
    fileAssociations: DeployFileAssociation[];
    protocols: string[];
    desktopActions: DeployDesktopAction[];
    desktopEntry: Record<string, string>;
    isDbusActivatable: boolean;
    extraFiles: Record<string, string>;
    versions: DeployVersions;
    arch: DeployArch;
    paths: DeployPaths;
    libraries: string[];
    deploy: DeployConfig;
};

type DeployPayload = {
    settings: DeploySettings;
    node: NodeRuntime | null;
    stage: StagedFile[];
    overlays: Record<DeployTargetName, StagedFile[]>;
};

type DeployManifest = {
    path: string;
    contents: string;
};

type DeployArtifact = {
    path: string;
    size: number;
};

type DeployTarget = {
    name: DeployTargetName;
    prefix: string;
    tools: DeployTool[];
    render: (payload: DeployPayload) => DeployManifest[];
    pack: (payload: DeployPayload, manifests: DeployManifest[]) => Promise<DeployArtifact[]>;
};

export type {
    DeployArch,
    DeployArtifact,
    DeployConfig,
    DeployDesktopAction,
    DeployDeveloper,
    DeployFileAssociation,
    DeployManifest,
    DeployPaths,
    DeployPayload,
    DeployRelease,
    DeployScreenshot,
    DeploySettings,
    DeployTarget,
    DeployTargetName,
    DeployTool,
    DeployVersions,
    NodeRuntime,
    PackageFamily,
    StagedFile,
};
