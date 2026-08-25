import type { Config } from "@gtkx/config";
import type { ResolvedApplicationIcon } from "../internal/icon-path.js";

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
    licenseFile: string | null;
    version: string;
    glibcMinimum: string | null;
    isStripped: boolean;
};

type Notice = {
    subject: string;
    license: string;
    source: string | null;
    copyright: string[];
    text: string | null;
};

type NoticeSection = {
    title: string;
    files: string[];
    summary: string[];
    notices: Notice[];
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

type DeployExtraFile = {
    destination: string;
    source: string;
    mode: number | null;
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
    applicationIcon: ResolvedApplicationIcon;
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
    extraFiles: DeployExtraFile[];
    versions: DeployVersions;
    arch: DeployArch;
    paths: DeployPaths;
    libraries: string[];
    minimumLibraryVersions: Record<string, string>;
    deploy: DeployConfig;
};

type DeployPayload = {
    settings: DeploySettings;
    node: NodeRuntime | null;
    stage: StagedFile[];
    notices: NoticeSection[];
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
    DeployExtraFile,
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
    Notice,
    NoticeSection,
    PackageFamily,
    StagedFile,
};
