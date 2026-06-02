import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { addDependency, detectPackageManager as nypmDetectPackageManager } from "nypm";
import { x } from "tinyexec";
import { renderFile } from "../templates.js";
import type { PackageManager, ScaffolderDeps } from "./scaffolder.js";

const KNOWN_PACKAGE_MANAGERS: readonly PackageManager[] = ["pnpm", "npm", "yarn"];

const isKnownPackageManager = (name: string): name is PackageManager =>
    (KNOWN_PACKAGE_MANAGERS as readonly string[]).includes(name);

/**
 * Production wiring for {@link createScaffolder}.
 *
 * Connects the scaffolder to the real filesystem, `@clack/prompts` (TTY),
 * `nypm` (package-manager-agnostic dependency installation), and
 * `tinyexec` (process spawning for `git init`).
 *
 * @returns The default {@link ScaffolderDeps} used by `createApp`.
 */
export const defaultScaffolderDeps = (): ScaffolderDeps => ({
    cwd: () => process.cwd(),
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
