import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DeploySettings, NodeRuntime, StagedFile } from "../../../src/deploy/types.js";
import { renderDesktopEntry } from "../../../src/deploy/freedesktop/desktop-entry.js";
import { renderMetainfo } from "../../../src/deploy/freedesktop/metainfo.js";
import { renderMimePackage } from "../../../src/deploy/freedesktop/mime-package.js";
import { stageOverlays, stagePayload } from "../../../src/deploy/payload/stage.js";
import { installTempProject, removeTempProject, type TempProject } from "../fixtures/project.js";

const state: { project: TempProject } = { project: { root: "", settings: {} as DeploySettings } };

const stage = (settings: DeploySettings, node: NodeRuntime | null = null): StagedFile[] =>
    stagePayload({
        settings,
        node,
        metadata: {
            desktopEntry: renderDesktopEntry(settings),
            metainfo: renderMetainfo(settings),
            mimePackage: renderMimePackage(settings),
        },
    });

const relativePaths = (files: StagedFile[]): string[] => files.map((file) => file.rel);

const serviceFor = (files: StagedFile[]): string =>
    readFileSync(files.find((file) => file.rel.includes("dbus-1"))?.abs ?? "", "utf8");

beforeEach(() => {
    state.project = installTempProject();
});

afterEach(() => {
    removeTempProject(state.project);
});

describe("stagePayload", () => {
    it("lays the whole payload out under one prefix", () => {
        expect(relativePaths(stage(state.project.settings))).toEqual([
            "bin/gtkx-tutorial",
            "lib/gtkx-tutorial/assets/style.css",
            "lib/gtkx-tutorial/bundle.js",
            "lib/gtkx-tutorial/gschemas.compiled",
            "lib/gtkx-tutorial/gtkx.gresource",
            "lib/gtkx-tutorial/gtkx.node",
            "share/applications/com.gtkx.tutorial.desktop",
            "share/glib-2.0/schemas/com.gtkx.tutorial.gschema.xml",
            "share/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg",
            "share/metainfo/com.gtkx.tutorial.metainfo.xml",
        ]);
    });

    it("keeps every runtime file a direct sibling of the bundle", () => {
        const nodePath = join(state.project.root, "node-stub");
        writeFileSync(nodePath, "ELF stub");
        const node: NodeRuntime = { path: nodePath, version: "24.18.1", glibcFloor: "2.28", isStripped: true };
        const staged = relativePaths(stage(state.project.settings, node));
        const siblings = ["bundle.js", "gtkx.node", "gtkx.gresource", "gschemas.compiled", "node"];

        for (const name of siblings) {
            expect(staged).toContain(`lib/gtkx-tutorial/${name}`);
        }
    });

    it("makes the launcher and the native code executable, and nothing else", () => {
        const staged = stage(state.project.settings);
        const modeFor = (rel: string): number | undefined => staged.find((file) => file.rel === rel)?.mode;
        expect(modeFor("bin/gtkx-tutorial")).toBe(0o755);
        expect(modeFor("lib/gtkx-tutorial/gtkx.node")).toBe(0o755);
        expect(modeFor("lib/gtkx-tutorial/bundle.js")).toBe(0o644);
        expect(modeFor("share/applications/com.gtkx.tutorial.desktop")).toBe(0o644);
    });

    it("installs the icon tree where the desktop looks for it, not beside the bundle", () => {
        const staged = relativePaths(stage(state.project.settings));
        expect(staged).toContain("share/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg");
        expect(staged.some((rel) => rel.startsWith("lib/gtkx-tutorial/icons"))).toBe(false);
    });
});

describe("stagePayload — the launcher", () => {
    it("writes a launcher that resolves everything from its own prefix", () => {
        const settings = state.project.settings;
        stage(settings);
        const launcher = readFileSync(join(settings.paths.stage, "bin/gtkx-tutorial"), "utf8");
        expect(launcher).toContain('prefix=$(dirname "$(dirname "$self")")');
        expect(launcher).toContain('exec "$prefix/lib/gtkx-tutorial/node" "$prefix/lib/gtkx-tutorial/bundle.js" "$@"');
        expect(launcher).not.toContain(settings.paths.root);
    });

    it("leaves no orphan behind when restaged over a dirty tree", () => {
        const settings = state.project.settings;
        stage(settings);
        writeFileSync(join(settings.paths.stage, "orphan.txt"), "stale");
        const staged = relativePaths(stage(settings));
        expect(staged).not.toContain("orphan.txt");
    });

    it("places extra files at their declared destinations", () => {
        const settings = { ...state.project.settings, extraFiles: { "share/extra/notes.txt": "LICENSE" } };
        expect(relativePaths(stage(settings))).toContain("share/extra/notes.txt");
    });
});

describe("stagePayload — rejected projects", () => {
    it("says which command to run when the app has not been built", () => {
        const settings = { ...state.project.settings };
        settings.paths = { ...settings.paths, dist: join(state.project.root, "missing") };
        expect(() => stage(settings)).toThrow("gtkx build");
    });

    it("names the expected icon path when the application icon is missing", () => {
        const settings = { ...state.project.settings, applicationId: "com.gtkx.other" };
        expect(() => stage(settings)).toThrow(/com\.gtkx\.other\.svg/);
    });

    it("rejects a schema whose file name would collide in the shared system directory", () => {
        const settings = { ...state.project.settings };
        settings.paths = { ...settings.paths, schemaFiles: [join(state.project.root, "data/other.gschema.xml")] };
        expect(() => stage(settings)).toThrow(/has to start with the application id/);
    });
});

describe("stageOverlays", () => {
    it("gives deb a copyright file and the others a license file", () => {
        const overlays = stageOverlays(state.project.settings);
        expect(relativePaths(overlays.deb)).toEqual(["share/doc/gtkx-tutorial/copyright"]);
        expect(relativePaths(overlays.rpm)).toEqual(["share/licenses/gtkx-tutorial/LICENSE"]);
        expect(relativePaths(overlays.flatpak)).toEqual(["share/licenses/gtkx-tutorial/LICENSE"]);
    });

    it("writes a D-Bus service naming each target's own prefix", () => {
        const overlays = stageOverlays({ ...state.project.settings, isDbusActivatable: true });
        expect(serviceFor(overlays.deb)).toContain("Exec=/usr/bin/gtkx-tutorial");
        expect(serviceFor(overlays.flatpak)).toContain("Exec=/app/bin/gtkx-tutorial");
    });

    it("writes no D-Bus service when the app is not activatable", () => {
        const overlays = stageOverlays(state.project.settings);
        expect(relativePaths(overlays.deb).some((rel) => rel.includes("dbus-1"))).toBe(false);
    });
});

describe("stagePayload — containment", () => {
    it("refuses an extra file that would escape the staging directory", () => {
        const settings = { ...state.project.settings, extraFiles: { "../../escaped.txt": "LICENSE" } };
        expect(() => stage(settings)).toThrow("resolves outside the staging directory");
    });

    it("refuses an extra file whose destination is absolute", () => {
        const settings = { ...state.project.settings, extraFiles: { "share/../../../etc/x": "LICENSE" } };
        expect(() => stage(settings)).toThrow("resolves outside the staging directory");
    });
});
