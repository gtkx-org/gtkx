import { sortStrings } from "@gtkx/utils";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import { getNamespace } from "../gir/libraries.js";
import { readJsonFile } from "../json.js";

const sharedProjectSchema = z.object({
    libraries: z.array(z.string()),
    girPath: z.array(z.string()),
    jsx: z.string().nullable(),
});

const sharedProjectsSchema = z.object({ projects: z.record(z.string(), sharedProjectSchema) });

/** What one project needs from a store it may share with other projects. */
type SharedProject = z.infer<typeof sharedProjectSchema>;

const PROJECTS_FILENAME = "projects.json";

const sharedProjectsPath = (storeDir: string): string =>
    join(dirname(storeDir), `.${basename(storeDir)}-store`, PROJECTS_FILENAME);

const readSharedProjects = (storeDir: string): Record<string, SharedProject> =>
    sharedProjectsSchema.safeParse(readJsonFile(sharedProjectsPath(storeDir))).data?.projects ?? {};

const otherProjects = (storeDir: string, owner: string): [string, SharedProject][] =>
    Object.entries(readSharedProjects(storeDir)).filter(([root]) => root !== owner && existsSync(root));

const sharingError = (storeDir: string, other: string, difference: string): Error =>
    new Error(
        `Cannot share the generated store in ${dirname(storeDir)} with ${other}: ${difference}. Projects that ` +
            "resolve the same store, such as the apps of a pnpm workspace, generate one set of bindings, so " +
            "align the projects, then run gtkx codegen again.",
    );

const checkCompatible = (storeDir: string, project: SharedProject, other: string, required: SharedProject): void => {
    if (JSON.stringify(required.girPath) !== JSON.stringify(project.girPath)) {
        throw sharingError(storeDir, other, "the projects search different GIR directories (`girPath`)");
    }

    if ((required.jsx === null) !== (project.jsx === null)) {
        throw sharingError(storeDir, other, "only one of the projects uses @gtkx/react");
    }

    if (required.jsx !== project.jsx) {
        throw sharingError(storeDir, other, "the projects configure different `elements`");
    }
};

const mergeLibraries = (storeDir: string, project: SharedProject, others: [string, SharedProject][]): string[] => {
    const merged: Map<string, string> = new Map(project.libraries.map((library) => [getNamespace(library), library]));

    for (const [other, required] of others) {
        for (const library of required.libraries) {
            const current = merged.get(getNamespace(library));

            if (current !== undefined && current !== library) {
                throw sharingError(storeDir, other, `the projects bind ${current} and ${library}`);
            }

            merged.set(getNamespace(library), library);
        }
    }

    return sortStrings([...merged.values()]);
};

/**
 * Returns the libraries a store shared with other live projects has to provide: the project's own when it is
 * alone, otherwise the union of every project's libraries.
 *
 * @throws If another project that shares the store needs a different GIR search path, element configuration
 * or React support, or binds another version of a namespace.
 */
const sharedLibraries = (storeDir: string, owner: string, project: SharedProject): string[] => {
    const others = otherProjects(storeDir, owner);

    for (const [other, required] of others) {
        checkCompatible(storeDir, project, other, required);
    }

    return others.length === 0 ? project.libraries : mergeLibraries(storeDir, project, others);
};

/** Records what a project needs from a shared store, dropping projects whose directories are gone. */
const registerSharedProject = (storeDir: string, owner: string, project: SharedProject): void => {
    const path = sharedProjectsPath(storeDir);
    const projects = Object.fromEntries([...otherProjects(storeDir, owner), [owner, project]]);
    const temporary = `${path}.${String(process.pid)}-${randomUUID()}`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporary, `${JSON.stringify({ projects }, null, 2)}\n`);
    renameSync(temporary, path);
};

/** Roots of the other live projects recorded as sharing the store at `storeDir`. */
const sharedProjectRoots = (storeDir: string, owner: string): string[] =>
    otherProjects(storeDir, owner).map(([root]) => root);

export { registerSharedProject, sharedLibraries, sharedProjectRoots, type SharedProject };
