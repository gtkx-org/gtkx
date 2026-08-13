import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DeployConfig, DeployPaths, DeploySettings } from "../../../src/deploy/types.js";
import { resolvePaths } from "../../../src/deploy/settings/paths.js";
import { installTempProject, removeTempProject, type TempProject } from "../fixtures/project.js";

const state: { project: TempProject } = { project: { root: "", settings: {} as DeploySettings } };

const resolveProjectPaths = (deploy: DeployConfig = {}, outDirOverride?: string): DeployPaths =>
    resolvePaths({ root: state.project.root, deploy, outDirOverride });

const writeAt = (rel: string, contents: string): void => {
    const path = join(state.project.root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
};

const removeAt = (rel: string): void => {
    rmSync(join(state.project.root, rel), { recursive: true, force: true });
};

beforeEach(() => {
    state.project = installTempProject();
});

afterEach(() => {
    removeTempProject(state.project);
});

describe("resolvePaths — the output directory", () => {
    it("defaults to a build directory under the project root", () => {
        expect(resolveProjectPaths().outDir).toBe(join(state.project.root, "build"));
    });

    it("hangs every payload directory off the output directory", () => {
        const resolved = resolveProjectPaths();
        const outDir = join(state.project.root, "build");
        expect(resolved.metadata).toBe(join(outDir, "metadata"));
        expect(resolved.runtime).toBe(join(outDir, "runtime"));
        expect(resolved.stage).toBe(join(outDir, "stage"));
        expect(resolved.overlay).toBe(join(outDir, "overlay"));
        expect(resolved.targets).toBe(join(outDir, "targets"));
        expect(resolved.output).toBe(join(outDir, "out"));
    });

    it("reports the root and the dist directory of the project", () => {
        const resolved = resolveProjectPaths();
        expect(resolved.root).toBe(state.project.root);
        expect(resolved.dist).toBe(join(state.project.root, "dist"));
    });

    it("takes the configured output directory", () => {
        expect(resolveProjectPaths({ outDir: "artifacts" }).outDir).toBe(join(state.project.root, "artifacts"));
    });
});

describe("resolvePaths — an overridden output directory", () => {
    it("resolves an override against the project root", () => {
        expect(resolveProjectPaths({}, "out/deploy").outDir).toBe(join(state.project.root, "out/deploy"));
    });

    it("prefers the override over the configured output directory", () => {
        expect(resolveProjectPaths({ outDir: "artifacts" }, "override").outDir).toBe(
            join(state.project.root, "override"),
        );
    });

    it("rejects an override that escapes the project root", () => {
        expect(() => resolveProjectPaths({}, "../evil")).toThrow("../evil");
    });

    it("says the rejected directory is outside the root", () => {
        expect(() => resolveProjectPaths({}, "../evil")).toThrow(`outside ${state.project.root}`);
    });

    it("rejects the project root itself", () => {
        expect(() => resolveProjectPaths({}, ".")).toThrow("as the deploy output directory");
    });

    it("rejects an absolute override outside the root", () => {
        expect(() => resolveProjectPaths({}, "/elsewhere")).toThrow("as the deploy output directory");
    });
});

describe("resolvePaths — the data directory", () => {
    it("reads the data directory from the package imports", () => {
        expect(resolveProjectPaths().dataDir).toBe("data");
    });

    it("finds the schema files under the data directory", () => {
        expect(resolveProjectPaths().schemaFiles).toEqual([
            join(state.project.root, "data/com.gtkx.tutorial.gschema.xml"),
        ]);
    });

    it("leaves the data directory unset when the package declares no data import", () => {
        writeAt("package.json", JSON.stringify({ name: "gtkx-tutorial" }));
        expect(resolveProjectPaths().dataDir).toBeNull();
    });

    it("reports no schema files when there is no data directory", () => {
        writeAt("package.json", JSON.stringify({ name: "gtkx-tutorial" }));
        expect(resolveProjectPaths().schemaFiles).toEqual([]);
    });
});

describe("resolvePaths — the icons directory", () => {
    it("points at the icons directory inside the data directory", () => {
        expect(resolveProjectPaths().iconsDir).toBe(join(state.project.root, "data/icons"));
    });

    it("leaves the single icon file unset by default", () => {
        expect(resolveProjectPaths().iconFile).toBeNull();
    });

    it("leaves the icons directory unset when the data directory has no icons", () => {
        removeAt("data/icons");
        expect(resolveProjectPaths().iconsDir).toBeNull();
    });

    it("leaves the icons directory unset when there is no data directory", () => {
        writeAt("package.json", JSON.stringify({ name: "gtkx-tutorial" }));
        expect(resolveProjectPaths().iconsDir).toBeNull();
    });
});

describe("resolvePaths — configured icons", () => {
    it("takes a configured directory as the icons directory", () => {
        const resolved = resolveProjectPaths({ icons: "dist/icons" });
        expect(resolved.iconsDir).toBe(join(state.project.root, "dist/icons"));
        expect(resolved.iconFile).toBeNull();
    });

    it("takes a configured file as the single icon file", () => {
        const icon = "data/icons/hicolor/scalable/apps/com.gtkx.tutorial.svg";
        const resolved = resolveProjectPaths({ icons: icon });
        expect(resolved.iconFile).toBe(join(state.project.root, icon));
        expect(resolved.iconsDir).toBeNull();
    });

    it("rejects a configured icon path that does not exist", () => {
        expect(() => resolveProjectPaths({ icons: "data/missing.svg" })).toThrow("Cannot read the icon path");
    });

    it("names the project root when the icon path cannot be read", () => {
        expect(() => resolveProjectPaths({ icons: "data/missing.svg" })).toThrow(state.project.root);
    });
});

describe("resolvePaths — the license file", () => {
    it("finds the license at the project root", () => {
        expect(resolveProjectPaths().licenseFile).toBe(join(state.project.root, "LICENSE"));
    });

    it("falls back to the next candidate name", () => {
        removeAt("LICENSE");
        writeAt("COPYING", "the license\n");
        expect(resolveProjectPaths().licenseFile).toBe(join(state.project.root, "COPYING"));
    });

    it("prefers LICENSE.md over COPYING", () => {
        removeAt("LICENSE");
        writeAt("COPYING", "the license\n");
        writeAt("LICENSE.md", "the license\n");
        expect(resolveProjectPaths().licenseFile).toBe(join(state.project.root, "LICENSE.md"));
    });

    it("leaves the license file unset when the project has none", () => {
        removeAt("LICENSE");
        expect(resolveProjectPaths().licenseFile).toBeNull();
    });
});

describe("resolvePaths — a configured license file", () => {
    it("resolves the configured path against the project root", () => {
        writeAt("legal/COPYING.txt", "the license\n");

        expect(resolveProjectPaths({ licenseFile: "legal/COPYING.txt" }).licenseFile).toBe(
            join(state.project.root, "legal/COPYING.txt"),
        );
    });

    it("wins over a license file lying at the project root", () => {
        writeAt("legal/COPYING.txt", "the license\n");

        expect(resolveProjectPaths({ licenseFile: "legal/COPYING.txt" }).licenseFile).not.toBe(
            join(state.project.root, "LICENSE"),
        );
    });

    it("rejects a configured license file that does not exist", () => {
        expect(() => resolveProjectPaths({ licenseFile: "MISSING" })).toThrow("Cannot read the license file");
    });

    it("rejects a configured license file that is a directory", () => {
        expect(() => resolveProjectPaths({ licenseFile: "data" })).toThrow("no such file under");
    });
});
