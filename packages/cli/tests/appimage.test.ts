import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli, runCliOrThrow } from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.appimage-probe";
const ARTIFACT_NAME = "appimage-probe.AppImage";
const APPLICATION_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">' +
    '<rect width="128" height="128" fill="#3584e4"/></svg>\n';
const ACTION_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">' +
    '<circle cx="64" cy="64" r="48" fill="#e01b24"/></svg>\n';
const CONFIG = `export default {
    applicationId: "${APPLICATION_ID}",
    applicationIcon: "icons",
    codegen: false,
    deploy: {
        name: "AppImage Probe",
        binaryName: "appimage-probe",
        developer: { name: "GTKX" },
        summary: "Exercises AppImage icon selection",
        description: ["An application that verifies the icons packaged in an AppImage."],
        categories: ["Utility"],
        license: "MPL-2.0",
        metadataLicense: "CC0-1.0",
        node: { source: "host" },
        appimage: { fileName: "${ARTIFACT_NAME}" },
    },
};\n`;
const ENTRY = 'process.stdout.write("AppImage probe\\n");\n';
const RASTER_192 = readFileSync(new URL("fixtures/appimage/icon-192.png", import.meta.url));
const RASTER_512 = readFileSync(new URL("fixtures/appimage/icon-512.png", import.meta.url));

const iconPath = (size: string, context: string, extension: string): string =>
    `icons/hicolor/${size}/${context}/${APPLICATION_ID}.${extension}`;

const withCompression = (compression: string): string =>
    CONFIG.replace("appimage: {", () => `appimage: { compression: ${JSON.stringify(compression)},`);

const extractedIcon = (
    icons: Record<string, string | Buffer>,
    extension: string,
    config = CONFIG,
): Buffer => {
    using project = createCliProject({
        prefix: "gtkx-appimage-icons-",
        config,
        files: { "src/index.ts": ENTRY, ...icons },
        hasStore: true,
    });
    runCliOrThrow(project, ["deploy", "--target", "appimage"]);
    const artifact = join(project.root, "build", "out", ARTIFACT_NAME);
    const filename = `${APPLICATION_ID}.${extension}`;
    const extracted = spawnSync(artifact, ["--appimage-extract", filename], {
        cwd: project.root,
        encoding: "utf8",
        timeout: 60_000,
    });
    expect(extracted.status).toBe(0);

    return readFileSync(join(project.root, "squashfs-root", filename));
};

describe("AppImage application icons", () => {
    it("packages a scalable application icon ahead of raster and action icons", () => {
        const icon = extractedIcon({
            [iconPath("scalable", "apps", "svg")]: APPLICATION_ICON,
            [iconPath("512x512", "apps", "png")]: RASTER_512,
            [iconPath("scalable", "actions", "svg")]: ACTION_ICON,
        }, "svg");
        expect(icon).toEqual(Buffer.from(APPLICATION_ICON));
    });

    it("chooses effective raster size and ignores another icon context", () => {
        const icon = extractedIcon({
            [iconPath("128x128@4", "apps", "png")]: RASTER_512,
            [iconPath("192x192", "apps", "png")]: RASTER_192,
            [iconPath("scalable", "actions", "svg")]: ACTION_ICON,
        }, "png");
        expect(icon).toEqual(RASTER_512);
    });

    it("packages an explicitly configured zstd AppImage", () => {
        const icon = extractedIcon({
            [iconPath("scalable", "apps", "svg")]: APPLICATION_ICON,
        }, "svg", withCompression("zstd"));
        expect(icon).toEqual(Buffer.from(APPLICATION_ICON));
    });

    it.each(["gzip", "xz"])("rejects unsupported %s compression while loading configuration", (compression) => {
        using project = createCliProject({
            prefix: "gtkx-appimage-unsupported-compression-",
            config: withCompression(compression),
            files: { "src/index.ts": ENTRY, [iconPath("scalable", "apps", "svg")]: APPLICATION_ICON },
            hasStore: true,
        });
        expect(runCli(project, ["build"]).status).not.toBe(0);
    });

    it("rejects a same-named icon outside the application context", () => {
        using project = createCliProject({
            prefix: "gtkx-appimage-unrelated-icon-",
            config: CONFIG,
            files: { "src/index.ts": ENTRY, [iconPath("scalable", "actions", "svg")]: ACTION_ICON },
            hasStore: true,
        });
        expect(runCli(project, ["deploy", "--target", "appimage"]).status).not.toBe(0);
    });
});
