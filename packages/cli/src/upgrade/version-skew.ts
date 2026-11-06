import { warn } from "@gtkx/utils";
import type { ArgsDef, CommandDef } from "citty";
import { existsSync, realpathSync } from "node:fs";
import { resolveCwd } from "../internal/entry-arg.js";
import {
    installedDirectory,
    linkedSourcePackages,
    PACKAGE_FIELDS,
    PROJECT_FIELDS,
} from "../internal/linked-packages.js";
import { gtkxDependencies, manifestPath, readManifest } from "./manifest.js";

type InstalledPackage = { name: string; version: string };

/**
 * Lists the GTKX packages Node resolves for the project at `root`, following each package's own GTKX
 * dependencies from where it is installed, so nested and isolated copies count separately. Dependencies
 * linked from source, such as the packages of a workspace, are followed too, because the application loads
 * the GTKX packages they resolve from their own directories.
 */
const installedGtkxPackages = (root: string): InstalledPackage[] => {
    const installed: Map<string, InstalledPackage> = new Map();

    const visit = (from: string, names: string[]): void => {
        for (const name of names) {
            const directory = installedDirectory(from, name);

            if (directory === null || installed.has(directory)) {
                continue;
            }

            const manifest = readManifest(directory);
            installed.set(directory, { name, version: manifest.version ?? "" });
            visit(directory, gtkxDependencies(manifest, PACKAGE_FIELDS));
        }
    };

    if (!existsSync(manifestPath(root))) {
        return [];
    }

    const project = realpathSync(root);
    visit(project, gtkxDependencies(readManifest(project), PROJECT_FIELDS));

    for (const directory of linkedSourcePackages(project)) {
        visit(directory, gtkxDependencies(readManifest(directory), PACKAGE_FIELDS));
    }

    return [...installed.values()];
};

const mostCommonVersion = (packages: InstalledPackage[]): string => {
    const counts: Map<string, number> = new Map();

    for (const { version } of packages) {
        counts.set(version, (counts.get(version) ?? 0) + 1);
    }

    return [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
};

/**
 * Warns once when the GTKX packages installed for the project at `root` do not all share one version.
 */
const warnVersionSkew = (root: string): void => {
    const packages = installedGtkxPackages(root);

    if (new Set(packages.map(({ version }) => version)).size < 2) {
        return;
    }

    const expected = mostCommonVersion(packages);
    const mismatched = [
        ...new Set(
            packages.filter(({ version }) => version !== expected).map(({ name, version }) => `${name} ${version}`),
        ),
    ].sort();
    warn(
        `GTKX packages are on different versions (${mismatched.join(", ")}; the rest on ${expected}). ` +
            "Run gtkx upgrade to move them to one version.",
    );
};

/**
 * Runs the version skew check before `command` starts.
 */
const withVersionSkewCheck = <T extends ArgsDef>(command: CommandDef<T>): CommandDef<T> => ({
    ...command,
    setup: async (context) => {
        const { cwd } = context.args;
        warnVersionSkew(resolveCwd(typeof cwd === "string" ? { cwd } : {}));
        await command.setup?.(context);
    },
});

export { installedGtkxPackages, withVersionSkewCheck };
