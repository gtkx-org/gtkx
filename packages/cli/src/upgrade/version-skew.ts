import { warn } from "@gtkx/utils";
import type { ArgsDef, CommandDef } from "citty";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { resolveCwd } from "../internal/entry-arg.js";
import { type DependencyField, gtkxDependencies, isGtkxPackage, manifestPath, readManifest } from "./manifest.js";

type InstalledPackage = { name: string; version: string };

const PROJECT_FIELDS: readonly DependencyField[] = ["dependencies", "devDependencies", "optionalDependencies"];
const PACKAGE_FIELDS: readonly DependencyField[] = ["dependencies", "optionalDependencies", "peerDependencies"];

const installedDirectory = (from: string, name: string): string | null => {
    for (let directory = from; ; directory = dirname(directory)) {
        const candidate = join(directory, "node_modules", name);

        if (existsSync(manifestPath(candidate))) {
            return realpathSync(candidate);
        }

        if (dirname(directory) === directory) {
            return null;
        }
    }
};

const isLinkedSource = (directory: string): boolean => !directory.split(sep).includes("node_modules");

/**
 * Lists the GTKX packages Node resolves for the project at `root`, following each package's own GTKX
 * dependencies from where it is installed, so nested and isolated copies count separately. Dependencies
 * linked from source, such as the packages of a workspace, are followed too, because the application loads
 * the GTKX packages they resolve from their own directories.
 */
const installedGtkxPackages = (root: string): InstalledPackage[] => {
    const installed: Map<string, InstalledPackage> = new Map();
    const sources: Set<string> = new Set();

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

    const visitSource = (directory: string, fields: readonly DependencyField[]): void => {
        sources.add(directory);
        const manifest = readManifest(directory);
        visit(directory, gtkxDependencies(manifest, fields));

        for (const name of new Set(fields.flatMap((field) => Object.keys(manifest[field] ?? {})))) {
            const linked = isGtkxPackage(name) ? null : installedDirectory(directory, name);

            if (linked !== null && isLinkedSource(linked) && !sources.has(linked)) {
                visitSource(linked, PACKAGE_FIELDS);
            }
        }
    };

    if (existsSync(manifestPath(root))) {
        visitSource(realpathSync(root), PROJECT_FIELDS);
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
