import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeployPayload, DeploySettings, StagedFile } from "../src/deploy/types.js";
import { appimageTarget } from "../src/deploy/targets/appimage.js";

const TOOLING = vi.hoisted(() => ({ runtime: "", tool: "" }));
const APPLICATION_ID = "com.gtkx.appimage-probe";
const BINARY_NAME = "appimage-probe";
const FILE_MODE = 0o644;

const TOOL_SOURCE = `#!/bin/sh
app_dir=""
artifact=""
for argument in "$@"; do
    app_dir="$artifact"
    artifact="$argument"
done
for extension in svg png xpm; do
    icon="$app_dir/${APPLICATION_ID}.$extension"
    if [ -f "$icon" ]; then
        cp "$icon" "$artifact"
        exit 0
    fi
done
exit 1
`;

const STATE: { root: string; settings: DeploySettings | null } = { root: "", settings: null };

const deployPaths = (root: string): DeploySettings["paths"] => {
    const outDir = join(root, "build");

    return {
        applicationIcon: { kind: "none" },
        dist: join(root, "dist"),
        licenseFile: null,
        metadata: join(outDir, "metadata"),
        outDir,
        output: join(outDir, "out"),
        overlay: join(outDir, "overlay"),
        root,
        runtime: join(outDir, "runtime"),
        schemaFiles: [],
        stage: join(outDir, "stage"),
        targets: join(outDir, "targets"),
    };
};

const deploySettings = (root: string): DeploySettings => {
    return {
        applicationId: APPLICATION_ID,
        arch: { appimage: "x86_64", deb: "amd64", flatpak: "x86_64", node: "x64", rpm: "x86_64" },
        binaryName: BINARY_NAME,
        branding: null,
        categories: [],
        contentRating: {},
        copyright: "",
        deploy: {
            categories: ["Utility"],
            description: ["AppImage icon selection probe."],
            developer: { name: "GTKX" },
            name: "AppImage Probe",
            summary: "Probes AppImage icon selection",
        },
        description: ["AppImage icon selection probe."],
        desktopActions: [],
        desktopEntry: {},
        developer: { email: null, id: null, name: "GTKX" },
        execArgs: [],
        execToken: null,
        extraFiles: [],
        fileAssociations: [],
        genericName: null,
        homepage: null,
        isDbusActivatable: false,
        keywords: [],
        libraries: [],
        license: "MPL-2.0",
        metadataLicense: "CC0-1.0",
        mimeTypes: [],
        minimumLibraryVersions: {},
        name: "AppImage Probe",
        paths: deployPaths(root),
        protocols: [],
        releases: [],
        screenshots: [],
        summary: "Probes AppImage icon selection",
        urls: {},
        versions: { debRevision: "1", epoch: null, packageVersion: "1.0.0", rpmRelease: "1", upstream: "1.0.0" },
    };
};

const currentSettings = (): DeploySettings => {
    const settings = STATE.settings;

    if (settings === null) {
        throw new Error("AppImage test setup did not run");
    }

    return settings;
};

const stageFile = (settings: DeploySettings, rel: string, contents: string): StagedFile => {
    const abs = join(settings.paths.stage, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
    chmodSync(abs, FILE_MODE);

    return { abs, mode: FILE_MODE, rel };
};

const payloadWith = (settings: DeploySettings, icons: StagedFile[]): DeployPayload => {
    const desktop = stageFile(
        settings,
        join("share", "applications", `${APPLICATION_ID}.desktop`),
        "[Desktop Entry]\nType=Application\n",
    );

    return {
        node: null,
        notices: [],
        overlays: { appimage: [], deb: [], flatpak: [], rpm: [] },
        settings,
        stage: [desktop, ...icons],
    };
};

const artifactContents = async (payload: DeployPayload): Promise<string> => {
    const [artifact] = await appimageTarget.pack(payload, []);

    if (artifact === undefined) {
        throw new Error("AppImage target produced no artifact");
    }

    return readFileSync(artifact.path, "utf8");
};

const setup = (): void => {
    STATE.root = mkdtempSync(join(tmpdir(), "gtkx-appimage-icons-"));
    STATE.settings = deploySettings(STATE.root);
    TOOLING.tool = join(STATE.root, "appimagetool");
    TOOLING.runtime = join(STATE.root, "runtime");
    writeFileSync(TOOLING.tool, TOOL_SOURCE);
    writeFileSync(TOOLING.runtime, "runtime\n");
    chmodSync(TOOLING.tool, 0o755);
};

const teardown = (): void => {
    rmSync(STATE.root, { force: true, recursive: true });
    STATE.settings = null;
};

const packageScalableIcon = (): Promise<string> => {
    const settings = currentSettings();

    const icon = stageFile(
        settings,
        join("share", "icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`),
        "scalable-icon\n",
    );

    return artifactContents(payloadWith(settings, [icon]));
};

const packageLargestRaster = (): Promise<string> => {
    const settings = currentSettings();

    const scaled = stageFile(
        settings,
        join("share", "icons", "hicolor", "128x128@2", "apps", `${APPLICATION_ID}.png`),
        "scaled-256px\n",
    );

    const unscaled = stageFile(
        settings,
        join("share", "icons", "hicolor", "192x192", "apps", `${APPLICATION_ID}.png`),
        "unscaled-192px\n",
    );

    const otherContext = stageFile(
        settings,
        join("share", "icons", "hicolor", "scalable", "actions", `${APPLICATION_ID}.svg`),
        "unrelated-action\n",
    );

    return artifactContents(payloadWith(settings, [unscaled, otherContext, scaled]));
};

const packageOtherContext = (): Promise<unknown> => {
    const settings = currentSettings();

    const otherContext = stageFile(
        settings,
        join("share", "icons", "hicolor", "scalable", "actions", `${APPLICATION_ID}.svg`),
        "unrelated-action\n",
    );

    return appimageTarget.pack(payloadWith(settings, [otherContext]), []);
};

vi.mock("../src/deploy/vendored/appimagetool.js", () => ({
    resolveAppimageTooling: () => Promise.resolve({ runtime: TOOLING.runtime, tool: TOOLING.tool }),
}));

describe("AppImage application icons", () => {
    beforeEach(setup);
    afterEach(teardown);

    it("packages a scalable application icon", async () => {
        await expect(packageScalableIcon()).resolves.toBe("scalable-icon\n");
    });

    it("chooses effective raster size and ignores another icon context", async () => {
        await expect(packageLargestRaster()).resolves.toBe("scaled-256px\n");
    });

    it("rejects a same-named icon outside the application context", async () => {
        await expect(packageOtherContext()).rejects.toThrow();
    });
});
