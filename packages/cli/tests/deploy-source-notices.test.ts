import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { flatpakManifest } from "./deploy-helpers.js";
import { type CliProject, createCliProject, runCli, runCliOrThrow } from "./cli-project.js";

const APPLICATION_ID = "org.gtkx.sourcenotice";
const BINARY_NAME = "gtkx-source-notice";
const DEPENDENCY_NAME = "@audit/source-dependency";
const ORIGINAL_TERMS = "Committed dependency license terms";
const REPLACEMENT_TERMS = "Local replacement license terms";
const NOTICES_FILE = "BUNDLED-NOTICES";
const INSTALLED_NOTICES_FILE = "THIRD-PARTY-NOTICES";
const PACKAGE = { name: BINARY_NAME, version: "1.0.0", type: "module" };
const BUILD_CONFIG = `export default { applicationId: "${APPLICATION_ID}", codegen: false };`;
const DEPLOY_CONFIG = `export default {
    applicationId: "${APPLICATION_ID}", applicationIcon: "application.svg", codegen: false,
    deploy: {
        name: "Source Notice", binaryName: "${BINARY_NAME}", developer: { name: "GTKX" },
        summary: "Source notice provenance probe",
        description: ["An application exercising source revision ownership of the actual bundled dependencies."],
        categories: ["Utility"], homepage: "https://gtkx.dev", license: "MPL-2.0", metadataLicense: "CC0-1.0",
        node: { source: "host" },
        flatpak: { mode: "source", source: { url: "https://github.com/gtkx-org/cli-deploy-probe.git" } },
    },
};`;

type FlatpakManifest = ReturnType<typeof flatpakManifest>;

const files = (): Record<string, string> => ({
    "application.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>',
    "package.json": JSON.stringify(PACKAGE),
    "package-lock.json": JSON.stringify({ ...PACKAGE, lockfileVersion: 3, packages: { "": PACKAGE } }),
    "src/index.ts": 'import { message } from "../vendor/dependency/index.js"; process.stdout.write(message);',
    "vendor/dependency/package.json": JSON.stringify({
        name: DEPENDENCY_NAME, version: "1.0.0", type: "module", license: "MIT",
    }),
    "vendor/dependency/index.js": 'export const message = "committed dependency";',
    "vendor/dependency/LICENSE": ORIGINAL_TERMS,
});

const buildNotices = (project: CliProject): string =>
    readFileSync(join(project.root, "dist", NOTICES_FILE), "utf8");

const sourceManifest = (project: CliProject): FlatpakManifest => parse(readFileSync(
    join(project.root, "build", process.arch, "targets/flatpak", `${APPLICATION_ID}.yml`),
    "utf8",
)) as FlatpakManifest;

const git = (project: CliProject, args: string[]): string =>
    execFileSync(resolveExecutable("git"), args, { cwd: project.root, encoding: "utf8" }).trim();

const commitSource = (project: CliProject): string => {
    git(project, ["init", "--quiet"]);
    git(project, ["add", "gtkx.config.ts", ...Object.keys(files())]);
    git(project, [
        "-c", "user.name=Probe", "-c", "user.email=probe@gtkx.dev", "-c", "commit.gpgsign=false",
        "commit", "--quiet", "-m", "Source fixture",
    ]);

    return git(project, ["rev-parse", "HEAD"]);
};

const replaceDependency = (project: CliProject): void => {
    writeFileSync(join(project.root, "vendor/dependency/package.json"), JSON.stringify({
        name: DEPENDENCY_NAME, version: "2.0.0", type: "module", license: "ISC",
    }));
    writeFileSync(join(project.root, "vendor/dependency/index.js"), 'export const message = "replacement dependency";');
    writeFileSync(join(project.root, "vendor/dependency/LICENSE"), REPLACEMENT_TERMS);
};

const installSourceNotices = (project: CliProject, manifest: FlatpakManifest): string => {
    const sources = manifest.modules.flatMap((module) => module.sources).filter((source) => typeof source !== "string");
    const contents = sources.find((source) => source["dest-filename"] === INSTALLED_NOTICES_FILE)?.contents;

    if (contents === undefined) {
        throw new Error("Missing source notices");
    }

    writeFileSync(join(project.root, INSTALLED_NOTICES_FILE), contents);
    const commands = manifest.modules.flatMap((module) => module["build-commands"])
        .filter((command) => command.includes(INSTALLED_NOTICES_FILE));
    const destination = join(project.root, "flatpak-destination");
    execFileSync(resolveExecutable("sh"), ["-ec", commands.join("\n")], {
        cwd: project.root,
        env: { ...process.env, FLATPAK_DEST: destination },
        stdio: "pipe",
    });

    return readFileSync(join(destination, "share/licenses", BINARY_NAME, INSTALLED_NOTICES_FILE), "utf8");
};

describe("source build notice provenance", () => {
    it.each(["flatpak", "deb,flatpak"])("installs the committed build's notices for %s", (target) => {
        using project = createCliProject({
            prefix: "gtkx-source-notices-", config: DEPLOY_CONFIG, files: files(), hasStore: true,
        });
        const revision = commitSource(project);
        writeFileSync(join(project.root, "gtkx.config.ts"),
            DEPLOY_CONFIG.replace("source: { url:", () => `source: { commit: "${revision}", url:`));
        replaceDependency(project);
        runCliOrThrow(project, ["deploy", "--print-manifests", "--target", target]);
        const manifest = sourceManifest(project);
        expect(manifest.modules.flatMap((module) => module.sources)
            .some((source) => typeof source !== "string" && source.commit === revision))
            .toBe(true);
        git(project, ["checkout", "--quiet", revision, "--", "gtkx.config.ts", "src", "vendor"]);
        runCliOrThrow(project, ["build", "--config", "gtkx.config.ts"]);
        const notices = installSourceNotices(project, manifest);
        expect(readFileSync(join(project.root, "dist/bundle.mjs"), "utf8")).toContain("committed dependency");
        expect(notices).toContain(`${DEPENDENCY_NAME} 1.0.0`);
        expect(notices).toContain(ORIGINAL_TERMS);
        expect(notices).not.toContain(`${DEPENDENCY_NAME} 2.0.0`);
        expect(notices).not.toContain(REPLACEMENT_TERMS);
        expect(notices).toContain(`/app/lib/${BINARY_NAME}`);
        expect(notices).toContain("Node.js (org.freedesktop.Sdk.Extension.node26)");
    });

    it("builds dependency notices without deployment metadata", () => {
        using project = createCliProject({
            prefix: "gtkx-build-notices-", config: BUILD_CONFIG, files: files(), hasStore: true,
        });
        runCliOrThrow(project, ["build"]);
        expect(buildNotices(project)).toContain(`${DEPENDENCY_NAME} 1.0.0`);
        expect(buildNotices(project)).toContain(ORIGINAL_TERMS);
    });

    it("builds an application with no bundled JavaScript dependencies", () => {
        using project = createCliProject({
            prefix: "gtkx-empty-notices-", config: BUILD_CONFIG, hasStore: true,
            files: { "src/index.ts": 'process.stdout.write("application");' },
        });
        runCliOrThrow(project, ["build"]);
        expect(buildNotices(project)).not.toContain("Bundled JavaScript dependencies");
        expect(readFileSync(join(project.root, "dist/bundle.mjs"), "utf8")).toContain("application");
    });

    it("preserves the previous bundle and notices after an unsuccessful build", () => {
        using project = createCliProject({
            prefix: "gtkx-failed-notices-", config: BUILD_CONFIG, files: files(), hasStore: true,
        });
        runCliOrThrow(project, ["build"]);
        const previous = buildNotices(project);
        const bundle = readFileSync(join(project.root, "dist/bundle.mjs"));
        writeFileSync(join(project.root, "src/index.ts"), "export const broken = ;");
        expect(runCli(project, ["build"]).status).not.toBe(0);
        expect(buildNotices(project)).toBe(previous);
        expect(readFileSync(join(project.root, "dist/bundle.mjs"))).toEqual(bundle);
    });

    it("preserves recorded dependency notices when deployment skips rebuilding", () => {
        using project = createCliProject({
            prefix: "gtkx-skipped-notices-", config: DEPLOY_CONFIG, files: files(), hasStore: true,
        });
        runCliOrThrow(project, ["build"]);
        const previous = buildNotices(project);
        replaceDependency(project);
        runCliOrThrow(project, ["deploy", "--print-manifests", "--skip-build", "--target", "deb"]);
        const notices = readFileSync(
            join(project.root, "build", process.arch, "overlay/deb/share/doc", BINARY_NAME, "copyright"), "utf8",
        );
        expect(notices).toContain(`${DEPENDENCY_NAME} 1.0.0`);
        expect(notices).toContain(ORIGINAL_TERMS);
        expect(notices).not.toContain(REPLACEMENT_TERMS);
        expect(buildNotices(project)).toBe(previous);
        expect(existsSync(join(project.root, "build", process.arch, "stage/lib", BINARY_NAME, NOTICES_FILE)))
            .toBe(false);
    });

    it("fails source notice installation when the build artifact is missing", () => {
        using project = createCliProject({
            prefix: "gtkx-missing-notices-", config: DEPLOY_CONFIG, files: files(), hasStore: true,
        });
        runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "flatpak"]);
        const manifest = sourceManifest(project);
        rmSync(join(project.root, "dist", NOTICES_FILE), { force: true });
        expect(() => installSourceNotices(project, manifest)).toThrow();
    });
});
