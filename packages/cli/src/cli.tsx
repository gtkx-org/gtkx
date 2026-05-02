#!/usr/bin/env node

import "./refresh-runtime.js";

import { createRequire } from "node:module";
import { resolve } from "node:path";
import { events } from "@gtkx/ffi";
import { render } from "@gtkx/react";
import { defineCommand, runMain } from "citty";
import { resolveApplicationFlags } from "./app-flags.js";
import { build } from "./builder.js";
import { loadGtkxConfig } from "./codegen/config-loader.js";
import { preflightCodegen, runCodegen } from "./codegen/run-codegen.js";
import type { GtkxConfig } from "./config.js";
import { createApp } from "./create.js";
import { createDevServer } from "./dev-server.js";
import { startMcpClient, stopMcpClient } from "./mcp-client.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

type AppModule = {
    default: () => React.ReactNode;
};

type RuntimeConfig = {
    appId: string | undefined;
    appFlags: number | undefined;
};

const readRuntimeConfig = async (cwd: string): Promise<RuntimeConfig> => {
    let config: GtkxConfig | undefined;
    try {
        ({ config } = await loadGtkxConfig(cwd));
    } catch {
        return { appId: undefined, appFlags: undefined };
    }
    return {
        appId: config.appId,
        appFlags: resolveApplicationFlags(config.appFlags),
    };
};

const dev = defineCommand({
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
        console.log(`[gtkx] Starting dev server for ${entryPath}`);

        await preflightCodegen(cwd);

        const { appId: configAppId, appFlags } = await readRuntimeConfig(cwd);
        const appId = configAppId ?? "org.gtkx.dev";

        const server = await createDevServer({
            entry: entryPath,
            vite: {
                root: cwd,
            },
        });

        const mod = (await server.ssrLoadModule(entryPath)) as AppModule;
        const App = mod.default;

        if (typeof App !== "function") {
            console.error("[gtkx] Entry file must export a default function component");
            process.exit(1);
        }

        console.log(`[gtkx] Rendering app with ID: ${appId}`);
        render(<App />, appId, appFlags);

        await startMcpClient(appId);
        events.on("stop", () => {
            stopMcpClient();
        });

        console.log("[gtkx] HMR enabled - watching for changes...");
    },
});

const buildCmd = defineCommand({
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

        const { appId, appFlags } = await readRuntimeConfig(cwd);

        if (appId === undefined) {
            console.error("[gtkx] Build requires `appId` in gtkx.config.ts (reverse-DNS, e.g. com.example.myapp).");
            process.exit(1);
        }

        await build({
            entry,
            assetBase: args["asset-base"],
            appId,
            appFlags,
            vite: {
                root: cwd,
            },
        });

        console.log("[gtkx] Build complete: dist/bundle.js");
    },
});

const create = defineCommand({
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

const codegen = defineCommand({
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

const main = defineCommand({
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

runMain(main);
