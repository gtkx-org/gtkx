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

        expect(hasProjectPath(typescriptState.run, ".git")).toBe(true);
        expectGeneratedConfig(typescriptState.run);
        expect(readProject(typescriptState.run, "node_modules/.gtkx/env.d.ts")).toContain("gtkx codegen");
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
        expect(installs).toContain("typescript");
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
});

describe("create-gtkx and a directory that already holds files", () => {
    it("empties the directory when it is told to overwrite it", () => {
        const run = runCreate({ args: [...BASE_ARGS, "--overwrite"], files: { [STALE_FILE]: "old" } });

        try {
            expect(run.status).toBe(0);
            expect(listProject(run)).not.toContain(STALE_FILE);
        } finally {
            removeRun(run);
        }
    });

    it("refuses to scaffold over it otherwise", () => {
        const run = runCreate({ args: BASE_ARGS, files: { [STALE_FILE]: "old" } });

        try {
            expect(run.status).not.toBe(0);
            expect(listProject(run)).toContain(STALE_FILE);
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

    it("fails when the dependency install fails", () => {
        const run = runCreate({ args: BASE_ARGS, isInstallFailing: true });

        try {
            expect(run.status).not.toBe(0);
        } finally {
            removeRun(run);
        }
    });
});
