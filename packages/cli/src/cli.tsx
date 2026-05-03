#!/usr/bin/env node

import { type ChildProcess, fork } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand, runMain } from "citty";
import { build } from "./builder.js";
import { preflightCodegen, runCodegen } from "./codegen/run-codegen.js";
import { createApp } from "./create.js";
import { RELOAD_EXIT_CODE } from "./dev-protocol.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const DEV_RUNNER_URL = new URL("./dev-runner.js", import.meta.url);

const forwardSignal = (child: ChildProcess, signal: NodeJS.Signals): void => {
    if (!child.killed) {
        child.kill(signal);
    }
};

export const exitCodeForSignal = (signal: NodeJS.Signals | null): number => {
    if (!signal) return 0;
    return signal === "SIGINT" ? 130 : 143;
};

const runDevSupervisor = async (entryPath: string): Promise<never> => {
    const runnerPath = fileURLToPath(DEV_RUNNER_URL);
    let child: ChildProcess | null = null;
    let shuttingDown = false;

    const launch = (): void => {
        child = fork(runnerPath, [entryPath], { stdio: "inherit" });
        child.on("exit", (code, signal) => {
            child = null;
            if (shuttingDown) return;
            if (code === RELOAD_EXIT_CODE) {
                console.log("[gtkx] Restarting dev runner...");
                launch();
                return;
            }
            process.exit(code ?? exitCodeForSignal(signal));
        });
    };

    const onSignal = (signal: NodeJS.Signals): void => {
        shuttingDown = true;
        if (child) {
            forwardSignal(child, signal);
        } else {
            process.exit(0);
        }
    };

    process.on("SIGINT", () => onSignal("SIGINT"));
    process.on("SIGTERM", () => onSignal("SIGTERM"));

    launch();

    return new Promise<never>(() => {
        // Supervisor lives until the child exits non-reloadably and triggers process.exit above.
    });
};

export const dev = defineCommand({
    meta: {
        name: "dev",
        description: "Start development server with HMR",
    },
    args: {
        entry: {
            type: "positional",
            description: "Entry file (default: src/index.tsx)",
            required: false,
        },
    },
    async run({ args }) {
        const cwd = process.cwd();
        const entryPath = resolve(cwd, args.entry ?? "src/index.tsx");

        await preflightCodegen(cwd);

        await runDevSupervisor(entryPath);
    },
});

export const buildCmd = defineCommand({
    meta: {
        name: "build",
        description: "Build application for production",
    },
    args: {
        entry: {
            type: "positional",
            description: "Entry file (default: src/index.tsx)",
            required: false,
        },
        "asset-base": {
            type: "string",
            description: "Asset base path relative to executable directory (e.g., ../share/my-app)",
        },
    },
    async run({ args }) {
        const cwd = process.cwd();
        const entry = resolve(cwd, args.entry ?? "src/index.tsx");
        console.log(`[gtkx] Building ${entry}`);

        await preflightCodegen(cwd);

        await build({
            entry,
            assetBase: args["asset-base"],
            vite: {
                root: cwd,
            },
        });

        console.log("[gtkx] Build complete: dist/bundle.js");
    },
});

export const create = defineCommand({
    meta: {
        name: "create",
        description: "Create a new GTKX application",
    },
    args: {
        name: {
            type: "positional",
            description: "Project name",
            required: false,
        },
        "app-id": {
            type: "string",
            description: "App ID (e.g., com.example.myapp)",
        },
        pm: {
            type: "string",
            description: "Package manager (pnpm, npm, yarn)",
        },
        testing: {
            type: "string",
            description: "Testing setup (vitest, none)",
        },
        "claude-skills": {
            type: "boolean",
            description: "Include Claude Code skills for AI assistance",
        },
    },
    async run({ args }) {
        await createApp({
            name: args.name,
            appId: args["app-id"],
            packageManager: args.pm as "pnpm" | "npm" | "yarn" | undefined,
            testing: args.testing as "vitest" | "none" | undefined,
            claudeSkills: args["claude-skills"],
        });
    },
});

export const codegen = defineCommand({
    meta: {
        name: "codegen",
        description: "Generate TypeScript bindings for the GIR libraries declared in gtkx.config.ts",
    },
    args: {
        force: {
            type: "boolean",
            description: "Skip cache check and regenerate unconditionally",
            default: false,
        },
        cwd: {
            type: "string",
            description: "Project root (default: current working directory)",
        },
    },
    async run({ args }) {
        const cwd = args.cwd ? resolve(args.cwd) : process.cwd();
        const startedAt = Date.now();

        const result = await runCodegen({ cwd, force: args.force });

        if (!result.ran) {
            console.log("[gtkx] codegen: up to date (use --force to regenerate)");
            return;
        }

        if (result.configFile) {
            console.log(`[gtkx] codegen: config=${result.configFile}`);
        }
        if (result.config) {
            console.log(`[gtkx] codegen: libraries=${result.config.libraries.join(", ")}`);
        }
        if (result.girPath) {
            console.log(`[gtkx] codegen: girPath=${result.girPath.join(":")}`);
        }

        const total = Date.now() - startedAt;
        console.log(
            `[gtkx] codegen: ${result.namespaces} namespaces, ${result.widgets} widgets in ${result.duration}ms (total ${total}ms)`,
        );
    },
});

export const main = defineCommand({
    meta: {
        name: "gtkx",
        version,
        description: "CLI for GTKX - create and develop GTK4 React applications",
    },
    subCommands: {
        dev,
        build: buildCmd,
        codegen,
        create,
    },
});

if (import.meta.main) {
    runMain(main);
}
