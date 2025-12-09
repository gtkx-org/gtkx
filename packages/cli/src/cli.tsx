#!/usr/bin/env node

import { resolve } from "node:path";
import type { ApplicationFlags } from "@gtkx/ffi/gio";
import { render } from "@gtkx/react";
import { defineCommand, runMain } from "citty";
import { createApp } from "./create.js";
import { createDevServer } from "./dev-server.js";

interface AppModule {
    default: () => React.ReactNode;
    appId?: string;
    appFlags?: ApplicationFlags;
}

const dev = defineCommand({
    meta: {
        name: "dev",
        description: "Start development server with HMR",
    },
    args: {
        entry: {
            type: "positional",
            description: "Entry file (e.g., src/app.tsx)",
            required: true,
        },
    },
    async run({ args }) {
        const entryPath = resolve(process.cwd(), args.entry);
        console.log(`[gtkx] Starting dev server for ${entryPath}`);

        const server = await createDevServer({
            entry: entryPath,
            vite: {
                root: process.cwd(),
            },
        });

        const mod = (await server.ssrLoadModule(entryPath)) as AppModule;
        const App = mod.default;
        const appId = mod.appId ?? "org.gtkx.dev";
        const appFlags = mod.appFlags;

        if (typeof App !== "function") {
            console.error("[gtkx] Entry file must export a default function component");
            process.exit(1);
        }

        console.log(`[gtkx] Rendering app with ID: ${appId}`);
        render(<App />, appId, appFlags);

        console.log("[gtkx] HMR enabled - watching for changes...");
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
            description: "Package manager (pnpm, npm, yarn, bun)",
        },
        testing: {
            type: "string",
            description: "Testing framework (vitest, jest, node, none)",
        },
    },
    async run({ args }) {
        await createApp({
            name: args.name,
            appId: args["app-id"],
            packageManager: args.pm as "pnpm" | "npm" | "yarn" | "bun" | undefined,
            testing: args.testing as "vitest" | "jest" | "node" | "none" | undefined,
        });
    },
});

const main = defineCommand({
    meta: {
        name: "gtkx",
        version: "0.1.55",
        description: "CLI for GTKX - create and develop GTK4 React applications",
    },
    subCommands: {
        dev,
        create,
    },
});

runMain(main);
