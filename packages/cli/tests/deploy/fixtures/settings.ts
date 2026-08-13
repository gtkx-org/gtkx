import type { DeployPaths, DeploySettings } from "../../../src/deploy/types.js";

const ROOT = "/project";

const paths: DeployPaths = {
    root: ROOT,
    dist: `${ROOT}/dist`,
    outDir: `${ROOT}/build`,
    metadata: `${ROOT}/build/metadata`,
    runtime: `${ROOT}/build/runtime`,
    stage: `${ROOT}/build/stage`,
    overlay: `${ROOT}/build/overlay`,
    targets: `${ROOT}/build/targets`,
    output: `${ROOT}/build/out`,
    dataDir: "data",
    iconsDir: `${ROOT}/data/icons`,
    iconFile: null,
    licenseFile: null,
    schemaFiles: [`${ROOT}/data/com.gtkx.tutorial.gschema.xml`],
};

const tutorialSettings = (overrides: Partial<DeploySettings> = {}): DeploySettings => ({
    applicationId: "com.gtkx.tutorial",
    binaryName: "gtkx-tutorial",
    name: "Tasks",
    genericName: "Task Manager",
    summary: "Manage your tasks and to-dos",
    description: ["A task manager built with GTKX."],
    keywords: ["Task", "Todo"],
    categories: ["Office", "ProjectManagement"],
    mimeTypes: [],
    developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
    license: "MPL-2.0",
    metadataLicense: "CC0-1.0",
    copyright: "Copyright © 2026 GTKX",
    homepage: "https://gtkx.dev",
    urls: { bugtracker: "https://github.com/gtkx-org/gtkx/issues" },
    screenshots: [
        { url: "https://example.com/one.png", caption: "Browsing", isDefault: true },
        { url: "https://example.com/two.png", caption: null, isDefault: false },
    ],
    branding: { light: "#3584e4", dark: "#1a5fb4" },
    contentRating: {},
    releases: [
        { version: "1.0.0", date: "2026-07-13", type: null, urgency: null, notes: ["Initial release."], url: null },
    ],
    execArgs: [],
    execToken: null,
    fileAssociations: [],
    protocols: [],
    desktopActions: [],
    desktopEntry: {},
    isDbusActivatable: false,
    extraFiles: {},
    versions: { upstream: "1.0.0", packageVersion: "1.0.0", debRevision: "1", rpmRelease: "1", epoch: null },
    arch: { deb: "amd64", rpm: "x86_64", flatpak: "x86_64", appimage: "x86_64", node: "x64" },
    paths,
    libraries: ["Gtk-4.0", "Adw-1"],
    deploy: {},
    ...overrides,
});

export { tutorialSettings };
