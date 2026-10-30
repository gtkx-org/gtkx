import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join, matchesGlob, posix, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { MANIFEST_FILE, manifestPath, readManifest } from "./manifest.js";

type Workspace = {
    root: string;
    members: string[];
    catalogFile: string | null;
};

const PNPM_WORKSPACE_FILE = "pnpm-workspace.yaml";

const PnpmWorkspaceSchema = z.looseObject({ packages: z.array(z.string()).optional() }).nullable();

const workspacePatterns = (directory: string): string[] | null => {
    const pnpmWorkspace = join(directory, PNPM_WORKSPACE_FILE);

    if (existsSync(pnpmWorkspace)) {
        return PnpmWorkspaceSchema.parse(parse(readFileSync(pnpmWorkspace, "utf8")))?.packages ?? [];
    }

    if (!existsSync(manifestPath(directory))) {
        return null;
    }

    const { workspaces } = readManifest(directory);

    if (workspaces === undefined) {
        return null;
    }

    return Array.isArray(workspaces) ? workspaces : workspaces.packages;
};

const memberDirectories = (root: string, patterns: string[]): string[] => {
    const excluded = patterns.filter((pattern) => pattern.startsWith("!")).map((pattern) => pattern.slice(1));
    const included = patterns
        .filter((pattern) => !pattern.startsWith("!"))
        .map((pattern) => posix.join(pattern, MANIFEST_FILE));
    const members = globSync(included, { cwd: root, exclude: ["**/node_modules/**"] })
        .map((path) => dirname(path))
        .filter((member) => !excluded.some((pattern) => matchesGlob(member, pattern)))
        .map((member) => resolve(root, member));

    return [...new Set([root, ...members])];
};

const projectRoot = (cwd: string): string => {
    if (!existsSync(manifestPath(cwd))) {
        throw new Error(`No ${MANIFEST_FILE} in ${cwd}. Run gtkx upgrade from a project directory.`);
    }

    return cwd;
};

const enclosingWorkspace = (project: string): Omit<Workspace, "catalogFile"> | null => {
    for (let directory = project; ; directory = dirname(directory)) {
        const patterns = workspacePatterns(directory);

        if (patterns !== null) {
            const members = memberDirectories(directory, patterns);

            if (members.includes(project)) {
                return { root: directory, members };
            }
        }

        if (dirname(directory) === directory) {
            return null;
        }
    }
};

/**
 * Finds the packages an upgrade covers: every member of the npm, pnpm or Yarn workspace that contains
 * the project, or the project alone.
 */
const findWorkspace = (cwd: string): Workspace => {
    const project = projectRoot(cwd);
    const { root, members } = enclosingWorkspace(project) ?? { root: project, members: [project] };
    const catalogFile = join(root, PNPM_WORKSPACE_FILE);

    return { root, members, catalogFile: existsSync(catalogFile) ? catalogFile : null };
};

export { findWorkspace, type Workspace };
