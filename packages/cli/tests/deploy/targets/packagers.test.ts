import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DeployPayload } from "../../../src/deploy/types.js";
import { flatpakTarget } from "../../../src/deploy/targets/flatpak.js";
import { installTempProject, removeTempProject, type TempProject } from "../fixtures/project.js";
import { hasFlatpakBuilder } from "../tool-probes.js";

const state: { project: TempProject } = { project: { root: "", settings: {} as TempProject["settings"] } };

const payloadFor = (project: TempProject): DeployPayload => ({
    settings: project.settings,
    node: { path: "/node", version: "24.18.1", glibcFloor: "2.28", isStripped: true },
    stage: [],
    overlays: { appimage: [], deb: [], flatpak: [], rpm: [] },
});

const writeManifest = (project: TempProject, contents: string): string => {
    const dir = join(project.settings.paths.targets, "flatpak");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${project.settings.applicationId}.yml`);
    writeFileSync(path, contents);

    return path;
};

const showManifest = (path: string): Record<string, unknown> => {
    const builder = resolveExecutable("flatpak-builder");
    const output = execFileSync(builder, ["--show-manifest", path], { encoding: "utf8" });

    return JSON.parse(output) as Record<string, unknown>;
};

const renderTo = (project: TempProject): string => {
    const [manifest] = flatpakTarget.render(payloadFor(project));

    if (manifest === undefined) {
        throw new Error("the flatpak target rendered no manifest");
    }

    return writeManifest(project, manifest.contents);
};

beforeEach(() => {
    state.project = installTempProject();
});

afterEach(() => {
    removeTempProject(state.project);
});

describe.skipIf(!hasFlatpakBuilder())("the generated flatpak manifest", () => {
    it("is one flatpak-builder accepts and reads back unchanged", () => {
        const project = state.project;
        const parsed = showManifest(renderTo(project));

        expect(parsed).toMatchObject({
            id: "com.gtkx.tutorial",
            command: "gtkx-tutorial",
            "runtime-version": "50",
        });
    });

    it("keeps every build command flatpak-builder parses", () => {
        const project = state.project;
        const modules = showManifest(renderTo(project)).modules as { "build-commands": string[] }[];
        expect(modules.at(-1)?.["build-commands"]).toContain("cp -a stage/. ${FLATPAK_DEST}/");
    });
});
