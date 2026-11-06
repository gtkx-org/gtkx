import { existsSync, realpathSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { type DependencyField, isGtkxPackage, type Manifest, manifestPath, readManifest } from "../upgrade/manifest.js";

const PROJECT_FIELDS: readonly DependencyField[] = ["dependencies", "devDependencies", "optionalDependencies"];
const PACKAGE_FIELDS: readonly DependencyField[] = ["dependencies", "optionalDependencies", "peerDependencies"];
const ALL_FIELDS: readonly DependencyField[] = [...PROJECT_FIELDS, "peerDependencies"];
const APPLICATION_SOURCE_DEPENDENCIES: readonly string[] = ["@gtkx/i18n", "@gtkx/react"];

/**
 * Resolves the directory Node loads the package `name` from when it is imported from `from`, following symbolic
 * links, or `null` when no `node_modules` directory above `from` holds it.
 */
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
 * Lists the packages the project at `root` links from source, transitively, as resolved directories outside any
 * `node_modules`: workspace packages, and `link:` or `file:` directory dependencies that the package manager
 * links rather than copies. The project's own dependencies are followed through `dependencies`,
 * `devDependencies` and `optionalDependencies`, and each linked package's through `dependencies`,
 * `optionalDependencies` and `peerDependencies`. GTKX packages are never followed.
 */
const linkedSourcePackages = (root: string): string[] => {
    const project = realpathSync(root);
    const sources: Set<string> = new Set([project]);

    const visit = (directory: string, manifest: Manifest, fields: readonly DependencyField[]): void => {
        for (const name of new Set(fields.flatMap((field) => Object.keys(manifest[field] ?? {})))) {
            const linked = isGtkxPackage(name) ? null : installedDirectory(directory, name);

            if (linked !== null && isLinkedSource(linked) && !sources.has(linked)) {
                sources.add(linked);
                visit(linked, readManifest(linked), PACKAGE_FIELDS);
            }
        }
    };

    if (existsSync(manifestPath(project))) {
        visit(project, readManifest(project), PROJECT_FIELDS);
    }

    sources.delete(project);

    return [...sources];
};

const usesApplicationSources = (manifest: Manifest): boolean =>
    ALL_FIELDS.some((field) => APPLICATION_SOURCE_DEPENDENCIES.some((name) => manifest[field]?.[name] !== undefined));

/**
 * Lists the packages linked from source into the project at `root` (see {@link linkedSourcePackages}) that depend
 * on `@gtkx/react` or `@gtkx/i18n`. Vite loads and bundles their sources as part of the application, so their
 * messages, asset imports and GSettings schemas belong to the application's catalogs and declarations.
 */
const applicationSourcePackages = (root: string): string[] =>
    linkedSourcePackages(root).filter((directory) => usesApplicationSources(readManifest(directory)));

export { applicationSourcePackages, installedDirectory, linkedSourcePackages, PACKAGE_FIELDS, PROJECT_FIELDS };
