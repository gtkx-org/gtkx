import { sortStrings } from "@gtkx/utils";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    APPLICATION_ID,
    type CreateRun,
    hasProjectPath,
    listProject,
    PROJECT_NAME,
    readManifest,
    readProject,
    removeRun,
    runCreate,
} from "./create-project.js";

type Scripts = Record<string, string | undefined>;

const BASE_ARGS = ["--no-interactive", "--application-id", APPLICATION_ID, "--package-manager", "pnpm"];
const ICON_PATH = `data/icons/hicolor/scalable/apps/${APPLICATION_ID}.svg`;
const STALE_FILE = "stale.txt";
const CUSTOM_SOURCE = "src/custom.ts";
const EXISTING_MISE = '[tools]\nnode = "24.19.0"\npython = "3.13"\n\n[env]\nAPP_MODE = "dev"\n';
const ENV_MODULE = "node_modules/.gtkx/env.d.ts";
const UNKNOWN_FLAGS = [["--no-install"], ["-x"], ["--bogus=1"]];

const create = (args: string[] = []): CreateRun => runCreate({ args: [...BASE_ARGS, ...args] });
const getScripts = (run: CreateRun): Scripts => readManifest(run).scripts as Scripts;
const typescriptState = { run: {} as CreateRun };

const expectGeneratedConfig = (run: CreateRun): void => {
    const config = readProject(run, "gtkx.config.ts");
    expect(config).toContain(APPLICATION_ID);
    expect(config).toContain('applicationIcon: "data/icons"');
    expect(config).not.toContain("future:");
    expect(config).not.toContain("libraries:");
    expect(readManifest(run).imports).toBeUndefined();
};

beforeAll(() => {
    typescriptState.run = create(["--typescript", "--vitest"]);
}, 120_000);

afterAll(() => {
    removeRun(typescriptState.run);
});

describe("create-gtkx scaffolding a TypeScript project", () => {
    it("writes the project the templates describe", () => {
        expect(typescriptState.run.status).toBe(0);
        const files = listProject(typescriptState.run);

        expect(files).toEqual(expect.arrayContaining([
            "package.json",
            "gtkx.config.ts",
            "tsconfig.json",
            "vitest.config.ts",
            "src/app.tsx",
            "src/index.tsx",
            "src/gtkx-env.d.ts",
            "tests/app.test.tsx",
            ".mcp.json",
            ".claude/settings.json",
            ICON_PATH,
        ]));
        expect(files).not.toContain("mise.toml");

        expect(hasProjectPath(typescriptState.run, ".git")).toBe(true);
        expectGeneratedConfig(typescriptState.run);
        expect(readProject(typescriptState.run, "src/app.tsx")).toContain("<AdwApplication>");
        expect(readProject(typescriptState.run, "src/app.tsx")).toContain("<AdwApplicationWindow");
        expect(readProject(typescriptState.run, "src/app.tsx")).toContain("<AdwToolbarView");
        expect(readProject(typescriptState.run, "src/app.tsx")).toContain("<AdwHeaderBar");
        expect(readProject(typescriptState.run, ENV_MODULE)).toContain("gtkx codegen");
    });

    it("names the project after its directory and scripts every gtkx command", () => {
        expect(readManifest(typescriptState.run).name).toBe(PROJECT_NAME);

        expect(getScripts(typescriptState.run)).toMatchObject({
            dev: "gtkx dev",
            build: "gtkx build",
            codegen: "gtkx codegen",
            test: "vitest run",
        });
    });

    it("installs the runtime and development dependencies through its package manager", () => {
        const installs = typescriptState.run.installs.join("\n");
        expect(installs).toContain("@gtkx/react");
        expect(installs).toContain("@gtkx/cairo");
        expect(installs).toContain("@gtkx/cli");
        expect(installs).toContain("@gtkx/testing");
        expect(installs).toContain("typescript@^6.0.3");
    });

    it("records the build allowance pnpm understands", () => {
        expect(readProject(typescriptState.run, "pnpm-workspace.yaml")).toContain("allowBuilds:");
    });
});

describe("create-gtkx scaffolding for coding agents", () => {
    it("registers the MCP server and pre-approves the project's own commands", () => {
        const mcp = JSON.parse(readProject(typescriptState.run, ".mcp.json")) as {
            mcpServers: Record<string, { command: string; args: string[] }>;
        };

        expect(mcp.mcpServers.gtkx).toEqual({ command: "npx", args: ["gtkx", "mcp"] });

        const settings = JSON.parse(readProject(typescriptState.run, ".claude/settings.json")) as {
            permissions: { allow: string[] };
        };

        expect(settings.permissions.allow).toEqual(expect.arrayContaining([
            "Bash(npx gtkx codegen:*)",
            "Bash(npx vitest run:*)",
        ]));
    });

    it("keeps the generated reference out of git and the agent files in it", () => {
        const ignored = readProject(typescriptState.run, ".gitignore");
        expect(ignored).toContain(".gtkx/");
        expect(ignored).not.toContain("AGENTS.md");
    });
});

describe("create-gtkx scaffolding without TypeScript or testing", () => {
    it("emits JavaScript sources and leaves the TypeScript and testing files out", () => {
        const run = create(["--no-typescript", "--no-vitest"]);

        try {
            expect(run.status).toBe(0);
            const files = listProject(run);
            expect(files).toEqual(expect.arrayContaining(["src/app.jsx", "src/index.jsx"]));
            expect(files).not.toContain("tsconfig.json");
            expect(files).not.toContain("vitest.config.ts");
            expect(files).not.toContain("tests/app.test.tsx");
            expect(getScripts(run).test).toBeUndefined();
            expect(getScripts(run).typecheck).toBeUndefined();
        } finally {
            removeRun(run);
        }
    });
});

describe("create-gtkx and the package manager it scaffolds for", () => {
    it("records the build allowance npm and yarn understand", () => {
        const npmRun = runCreate({ args: ["--no-interactive", "--application-id", APPLICATION_ID, "-p", "npm"] });
        const yarnRun = runCreate({ args: ["--no-interactive", "--application-id", APPLICATION_ID, "-p", "yarn"] });

        try {
            expect(readManifest(npmRun).allowScripts).toMatchObject({ esbuild: true });
            expect(readManifest(yarnRun).dependenciesMeta).toMatchObject({ esbuild: { built: true } });
            expect(listProject(npmRun)).not.toContain("pnpm-workspace.yaml");
        } finally {
            removeRun(npmRun);
            removeRun(yarnRun);
        }
    });

    it("can leave dependency installation to the user", () => {
        const run = create(["--skip-install"]);

        try {
            expect(run.status).toBe(0);
            expect(run.installs).toEqual([]);
            expect(hasProjectPath(run, "node_modules")).toBe(false);
            expectGeneratedConfig(run);
            expect(readManifest(run).dependencies).toEqual({
                "@gtkx/cairo": "^2.0.0-beta.6",
                "@gtkx/css": "^2.0.0-beta.6",
                "@gtkx/react": "^2.0.0-beta.6",
                "@gtkx/runtime": "^2.0.0-beta.6",
                react: "latest",
            });
            expect(readManifest(run).devDependencies).toEqual({
                "@gtkx/cli": "^2.0.0-beta.6",
                "@gtkx/config": "^2.0.0-beta.6",
                "@gtkx/mcp": "^2.0.0-beta.6",
                "@gtkx/testing": "^2.0.0-beta.6",
                "@types/node": "latest",
                "@types/react": "latest",
                typescript: "^6.0.3",
                vite: "latest",
                vitest: "latest",
            });
        } finally {
            removeRun(run);
        }
    });
});

describe("create-gtkx runtime requirements", () => {
    it("rejects runtimes below the supported Node.js version before scaffolding", () => {
        const run = runCreate({ args: [...BASE_ARGS, "--skip-install"], nodeVersion: "26.6.0" });

        try {
            expect(() => {
                if (run.status !== 0) {
                    throw new Error(run.output);
                }
            }).toThrow();
        } finally {
            removeRun(run);
        }
    });
});

describe("create-gtkx and a directory that already holds files", () => {
    it("preserves unrelated files and lists the scaffold files it replaces", () => {
        const run = runCreate({
            args: [...BASE_ARGS, "--overwrite"],
            files: {
                [CUSTOM_SOURCE]: "custom source",
                [ENV_MODULE]: "stale env module",
                "gtkx.config.ts": "stale config",
                "mise.toml": EXISTING_MISE,
            },
        });

        try {
            expect(run.status).toBe(0);
            expect(readProject(run, CUSTOM_SOURCE)).toBe("custom source");
            expect(readProject(run, "gtkx.config.ts")).not.toBe("stale config");
            expect(readProject(run, ENV_MODULE)).toContain("gtkx codegen");
            expect(readProject(run, "mise.toml")).toBe(EXISTING_MISE);
            expect(run.output).toContain("Scaffold files to replace");
            expect(run.output).toContain("Replaced scaffold files");
            expect(run.output.match(/gtkx\.config\.ts/g)).toHaveLength(2);
            expect(run.output).not.toContain("mise.toml");
            expect(run.output).not.toContain("node_modules");
            expect(run.output).not.toContain(CUSTOM_SOURCE);
            expect(hasProjectPath(run, ".git")).toBe(false);
        } finally {
            removeRun(run);
        }
    });

    it("joins an existing parent repository without nesting another one", () => {
        const run = runCreate({ args: BASE_ARGS, hasParentGit: true });

        try {
            expect(run.status).toBe(0);
            expect(hasProjectPath(run, ".git")).toBe(false);
        } finally {
            removeRun(run);
        }
    });

    it("refuses to scaffold over it otherwise", () => {
        const run = runCreate({ args: BASE_ARGS, files: { [STALE_FILE]: "old", "gtkx.config.ts": "stale config" } });
        const userFilesRun = runCreate({ args: BASE_ARGS, files: { [STALE_FILE]: "old" } });

        try {
            expect(run.status).not.toBe(0);
            expect(sortStrings(listProject(run))).toEqual(["gtkx.config.ts", STALE_FILE]);
            expect(readProject(run, "gtkx.config.ts")).toBe("stale config");
            expect(userFilesRun.status).not.toBe(0);
            expect(listProject(userFilesRun)).toEqual([STALE_FILE]);
        } finally {
            removeRun(run);
            removeRun(userFilesRun);
        }
    });

    it("refuses to replace a directory at a scaffold file destination", () => {
        const nested = join("src", "app.tsx", STALE_FILE);
        const run = runCreate({
            args: [...BASE_ARGS, "--overwrite"],
            files: { [nested]: "old", "gtkx.config.ts": "stale config" },
        });

        try {
            expect(run.status).not.toBe(0);
            expect(readProject(run, nested)).toBe("old");
            expect(readProject(run, "gtkx.config.ts")).toBe("stale config");
        } finally {
            removeRun(run);
        }
    });

    it("refuses to write through a symbolic-link ancestor", () => {
        const run = runCreate({
            args: [...BASE_ARGS, "--overwrite"],
            files: { "../outside/app.tsx": "outside", "gtkx.config.ts": "stale config" },
            links: { src: "../outside" },
        });

        try {
            expect(run.status).not.toBe(0);
            expect(readProject(run, "../outside/app.tsx")).toBe("outside");
            expect(readProject(run, "gtkx.config.ts")).toBe("stale config");
        } finally {
            removeRun(run);
        }
    });
});

describe("create-gtkx display names", () => {
    it("propagates an explicit display name to the generated application", () => {
        const run = runCreate({
            args: [...BASE_ARGS, "--display-name", "Clean My Linux", "--no-typescript", "--no-vitest"],
            name: "cleanmylinux",
        });

        try {
            expect(run.status).toBe(0);
            expect(readProject(run, "gtkx.config.js")).toContain('name: "Clean My Linux"');
            expect(readProject(run, "src/app.jsx")).toContain('title={"Clean My Linux"}');
        } finally {
            removeRun(run);
        }
    });

    it("derives a display name from a hyphenated project name", () => {
        expect(readProject(typescriptState.run, "gtkx.config.ts")).toContain('name: "My App"');
        expect(readProject(typescriptState.run, "src/app.tsx")).toContain('title={"My App"}');
    });

    it("fails when the display name is empty", () => {
        const run = runCreate({ args: [...BASE_ARGS, "--display-name", " ".repeat(3)] });

        try {
            expect(run.status).not.toBe(0);
        } finally {
            removeRun(run);
        }
    });
});

describe("create-gtkx refusing to scaffold", () => {
    it("fails on an application id that is not reverse domain notation", () => {
        const run = runCreate({ args: ["--no-interactive", "--application-id", "nope"] });

        try {
            expect(run.status).not.toBe(0);
        } finally {
            removeRun(run);
        }
    });

    it("fails on a project name that is not lowercase and hyphenated", () => {
        const run = runCreate({ args: BASE_ARGS, name: "My App" });

        try {
            expect(run.status).not.toBe(0);
        } finally {
            removeRun(run);
        }
    });

    it("fails on a package manager it does not know", () => {
        const run = runCreate({
            args: ["--no-interactive", "--application-id", APPLICATION_ID, "--package-manager", "bun"],
        });

        try {
            expect(run.status).not.toBe(0);
        } finally {
            removeRun(run);
        }
    });

    it("fails on an unknown flag", () => {
        for (const flags of UNKNOWN_FLAGS) {
            const run = runCreate({ args: [...BASE_ARGS, ...flags] });

            try {
                expect(() => {
                    if (run.status !== 0) {
                        throw new Error(run.output);
                    }
                }).toThrow();
                expect(hasProjectPath(run, "package.json")).toBe(false);
            } finally {
                removeRun(run);
            }
        }
    });

    it("fails when the dependency install fails", () => {
        const run = runCreate({ args: BASE_ARGS, isInstallFailing: true });

        try {
            expect(run.status).not.toBe(0);
        } finally {
            removeRun(run);
        }
    });
});
