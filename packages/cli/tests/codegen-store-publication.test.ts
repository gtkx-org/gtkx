import { spawnSync } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    type DisposableCliProject,
    runCliOrThrow,
} from "./cli-project.js";
import { fixtureLibrariesConfig } from "./codegen-helpers.js";

const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const DOCUMENTED_PROBE = `import type * as Documented from "@gtkx/gi/documented";
import type * as DocumentedJsx from "@gtkx/jsx/documented";

export type Generated = [keyof typeof Documented, keyof typeof DocumentedJsx];
`;
const HOOK_SLOTS_PROBE = `import type * as HookSlots from "@gtkx/gi/hookslots";
import type * as HookSlotsJsx from "@gtkx/jsx/hookslots";

export type Generated = [keyof typeof HookSlots, keyof typeof HookSlotsJsx];
`;
const TSCONFIG = `${JSON.stringify({
    compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: "ESNext",
    },
    files: ["probe.ts"],
}, null, 4)}\n`;
const RESOLVE_PROBE = `process.stdout.write(JSON.stringify({
    gi: import.meta.resolve("@gtkx/gi/gobject"),
    jsx: import.meta.resolve("@gtkx/jsx/gobject"),
}));`;

type ResolvedEntries = { gi: string; jsx: string };

const writeConfig = (project: CliProject, source: string): void => {
    writeFileSync(join(project.root, "gtkx.config.ts"), source);
};

const writeProbe = (project: CliProject, source: string): void => {
    writeFileSync(join(project.root, "probe.ts"), source);
};

const runTypecheck = (project: CliProject): number | null =>
    spawnSync(process.execPath, [TYPESCRIPT_CLI, "--project", "tsconfig.json"], {
        cwd: project.root,
    }).status;

const resolveEntries = (project: CliProject): ResolvedEntries => {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", RESOLVE_PROBE], {
        cwd: project.root,
        encoding: "utf8",
    });

    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);

    const resolved = JSON.parse(result.stdout) as ResolvedEntries;

    return { gi: fileURLToPath(resolved.gi), jsx: fileURLToPath(resolved.jsx) };
};

const createPublicationProject = (): DisposableCliProject =>
    createCliProject({
        prefix: "gtkx-cli-codegen-publication-",
        config: fixtureLibrariesConfig(["Documented-1.0"]),
        files: { "probe.ts": DOCUMENTED_PROBE, "tsconfig.json": TSCONFIG },
    });

const generationCount = (project: CliProject): number =>
    readdirSync(join(project.nodeModules, ".gtkx"), { withFileTypes: true })
        .filter((entry) =>
            entry.isDirectory() &&
            [
                ".generation-",
                ".pair-generation-",
                ".gi-generation-",
                ".gi-legacy-",
                ".jsx-generation-",
                ".jsx-legacy-",
            ].some((prefix) => entry.name.startsWith(prefix)))
        .length;

describe("gtkx codegen store publication", () => {
    it("publishes each generated pair as resolvable, type-safe packages", () => {
        using project = createPublicationProject();
        runCliOrThrow(project, ["codegen"]);
        expect(runTypecheck(project)).toBe(0);
        const documented = resolveEntries(project);
        expect(existsSync(documented.gi)).toBe(true);
        expect(existsSync(documented.jsx)).toBe(true);

        writeConfig(project, fixtureLibrariesConfig(["HookSlots-1.0"]));
        writeProbe(project, HOOK_SLOTS_PROBE);
        runCliOrThrow(project, ["codegen", "--force"]);
        expect(runTypecheck(project)).toBe(0);
        const hookSlots = resolveEntries(project);
        expect(hookSlots.gi).not.toBe(documented.gi);
        expect(hookSlots.jsx).not.toBe(documented.jsx);
    });

    it("keeps a resolved generation available after a later generation becomes current", () => {
        using project = createPublicationProject();
        runCliOrThrow(project, ["codegen"]);
        const previous = resolveEntries(project);
        const previousGeneration = realpathSync(join(project.nodeModules, ".gtkx", "current"));

        writeConfig(project, fixtureLibrariesConfig(["HookSlots-1.0"]));
        runCliOrThrow(project, ["codegen", "--force"]);
        expect(realpathSync(join(project.nodeModules, ".gtkx", "current"))).not.toBe(previousGeneration);
        expect(existsSync(previous.gi)).toBe(true);
        expect(existsSync(previous.jsx)).toBe(true);
        const giStore = dirname(dirname(previous.gi));
        const jsxStore = dirname(dirname(previous.jsx));
        expect(realpathSync(join(jsxStore, "node_modules", "@gtkx", "gi"))).toBe(giStore);
    });

    it("preserves the published packages when the next generation fails", () => {
        using project = createPublicationProject();
        runCliOrThrow(project, ["codegen"]);
        expect(runTypecheck(project)).toBe(0);
        const published = resolveEntries(project);

        writeConfig(project, fixtureLibrariesConfig(["InvalidXml-1.0"]));
        expect(() => runCliOrThrow(project, ["codegen", "--force"])).toThrow();
        expect(runTypecheck(project)).toBe(0);
        expect(resolveEntries(project)).toEqual(published);
    });

    it("keeps the JSX store when a GI-only run publishes", () => {
        using project = createPublicationProject();
        runCliOrThrow(project, ["codegen"]);
        const previous = resolveEntries(project);
        rmSync(join(project.nodeModules, "@gtkx", "react"));
        rmSync(join(project.nodeModules, "@gtkx", "jsx"));

        runCliOrThrow(project, ["codegen", "--force"]);
        const current = resolveEntries(project);
        const giStore = dirname(dirname(current.gi));
        const jsxStore = dirname(dirname(current.jsx));

        expect(current.gi).not.toBe(previous.gi);
        expect(current.jsx).not.toBe(previous.jsx);
        expect(realpathSync(join(jsxStore, "node_modules", "@gtkx", "gi"))).toBe(giStore);
    });

    it("counts beta pair generations toward the retention limit", () => {
        using project = createPublicationProject();
        runCliOrThrow(project, ["codegen"]);
        const root = join(project.nodeModules, ".gtkx");

        for (let index = 0; index < 4; index += 1) {
            const path = join(root, `.pair-generation-legacy-${String(index)}`);
            mkdirSync(path);
        }

        runCliOrThrow(project, ["codegen", "--force"]);
        expect(generationCount(project)).toBeLessThanOrEqual(3);
    });

    it("keeps resolved beta generations available while migrating their layout", () => {
        using project = createPublicationProject();
        runCliOrThrow(project, ["codegen"]);
        const root = join(project.nodeModules, ".gtkx");
        const published = realpathSync(join(root, "current"));
        const betaGi = join(root, ".gi-generation-beta");
        const betaJsx = join(root, ".jsx-generation-beta");
        cpSync(join(published, "gi"), betaGi, { recursive: true });
        cpSync(join(published, "jsx"), betaJsx, { recursive: true });
        const nestedGi = join(betaJsx, "node_modules", "@gtkx", "gi");
        rmSync(nestedGi, { force: true });
        symlinkSync(relative(dirname(nestedGi), betaGi), nestedGi, "dir");
        rmSync(join(root, "gi"), { force: true });
        rmSync(join(root, "jsx"), { force: true });
        rmSync(join(root, "current"), { force: true });
        rmSync(published, { recursive: true, force: true });
        symlinkSync(relative(root, betaGi), join(root, "gi"), "dir");
        symlinkSync(relative(root, betaJsx), join(root, "jsx"), "dir");
        const beta = resolveEntries(project);

        runCliOrThrow(project, ["codegen", "--force"]);

        const current = resolveEntries(project);
        expect(current).not.toEqual(beta);
        expect(existsSync(beta.gi)).toBe(true);
        expect(existsSync(beta.jsx)).toBe(true);
        expect(realpathSync(nestedGi)).toBe(betaGi);
        expect(runTypecheck(project)).toBe(0);
        expect(generationCount(project)).toBeLessThanOrEqual(3);
    });
});
