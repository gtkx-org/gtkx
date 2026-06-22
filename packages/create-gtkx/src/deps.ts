import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as p from "@clack/prompts";
import { addDependency, detectPackageManager as nypmDetectPackageManager } from "nypm";
import { x } from "tinyexec";
import { isKnownPackageManager, type PackageManager } from "./options.js";
import type { ScaffolderDeps } from "./scaffolder.js";
import { listTemplates, renderFile } from "./templates.js";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

export const defaultScaffolderDeps = (): ScaffolderDeps => ({
    cwd: () => process.cwd(),
    gtkxVersion: version,
    fs: { existsSync, mkdirSync, writeFileSync },
    prompts: {
        intro: p.intro,
        spinner: () => {
            const spin = p.spinner();
            return {
                start: (message: string) => spin.start(message),
                stop: (message: string) => spin.stop(message),
            };
        },
        note: p.note,
        log: p.log,
        cancel: p.cancel,
        text: p.text,
        select: p.select,
        confirm: p.confirm,
        isCancel: p.isCancel,
    },
    listTemplates,
    render: renderFile,
    install: async ({ cwd, packageManager, dependencies, dev }) => {
        if (dependencies.length === 0) return;
        await addDependency(dependencies, { cwd, packageManager, dev, silent: true });
    },
    gitInit: async (cwd: string) => {
        const opts = { nodeOptions: { cwd }, throwOnError: true } as const;
        await x("git", ["init"], opts);
        await x("git", ["add", "-A"], opts);
        await x("git", ["commit", "-m", "Initial commit"], opts);
    },
    detectPackageManager: async (cwd: string): Promise<PackageManager | undefined> => {
        const detected = await nypmDetectPackageManager(cwd, { includeParentDirs: true });
        if (!detected) return undefined;
        return isKnownPackageManager(detected.name) ? detected.name : undefined;
    },
    exit: (code: number): never => process.exit(code),
});
