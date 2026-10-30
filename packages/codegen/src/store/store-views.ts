import { randomUUID } from "node:crypto";
import {
    existsSync,
    lstatSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    readlinkSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { z } from "zod";
import { getNamespace } from "../gir/libraries.js";
import { readJsonFile } from "../json.js";
import { type NamespaceIncludes, readNamespaceIncludes } from "./gi/namespace-includes.js";
import { resolvesStoreIn } from "./resolve-store.js";
import { readSharedProject, type SharedProject } from "./shared-store.js";
import { realpathOrNull, type StoreOptions, symlinkRelative } from "./store-fs.js";

type ViewedStore = Pick<StoreOptions, "storeDir" | "linkDir">;

type NamespaceView = { storeDir: string; viewDir: string; namespaces: Set<string> };

const storeManifestSchema = z.looseObject({ name: z.string(), exports: z.record(z.string(), z.unknown()) });

const SCOPE = "@gtkx";
const MANIFEST_FILENAME = "package.json";
const MANIFEST_EXPORT = `./${MANIFEST_FILENAME}`;
const STUB_FILENAME = "index.d.ts";

const canonicalPath = (path: string): string => realpathOrNull(path) ?? resolve(path);

/**
 * Where a project keeps its view of a store written into another `node_modules`, such as the root of a pnpm
 * workspace: `@gtkx/gi` or `@gtkx/jsx` in its own `node_modules`. Null when the store was written into the
 * project's own `node_modules`, whose link then exposes the whole store.
 */
const storeViewDir = (projectRoot: string, store: ViewedStore): string | null => {
    const nodeModules = join(projectRoot, "node_modules");
    const viewDir = join(nodeModules, SCOPE, basename(store.linkDir));
    const isOwnStore = canonicalPath(nodeModules) === canonicalPath(dirname(dirname(store.storeDir)));

    return isOwnStore || canonicalPath(viewDir) === canonicalPath(store.linkDir) ? null : viewDir;
};

const viewNamespaces = (includes: NamespaceIncludes, libraries: string[]): Set<string> => {
    const namespaces: Set<string> = new Set();
    const pending = libraries.map((library) => getNamespace(library).toLowerCase());

    for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
        if (!namespaces.has(directory)) {
            namespaces.add(directory);
            pending.push(...(includes[directory] ?? []));
        }
    }

    return namespaces;
};

const stubSource = (specifier: string): string =>
    "/**\n" +
    ` * ${specifier} is not available to this project: the GIR library it binds is missing from \`libraries\` in\n` +
    " * gtkx.config.ts, although another project sharing the generated bindings declares it.\n" +
    " */\n" +
    "export {};\n";

const writeFileIfChanged = (path: string, content: string): void => {
    if (existsSync(path) && readFileSync(path, "utf8") === content) {
        return;
    }

    const temporary = join(dirname(path), `.${basename(path)}.${String(process.pid)}-${randomUUID()}`);
    writeFileSync(temporary, content);
    renameSync(temporary, path);
};

const linkNamespace = (view: NamespaceView, directory: string): void => {
    const path = join(view.viewDir, directory);
    const target = join(view.storeDir, directory);
    const entry = lstatSync(path, { throwIfNoEntry: false });

    if (entry?.isSymbolicLink() && readlinkSync(path) === relative(view.viewDir, target)) {
        return;
    }

    if (entry?.isDirectory()) {
        rmSync(path, { recursive: true });
    }

    symlinkRelative(path, target);
};

const isStubDir = (path: string): boolean =>
    lstatSync(path, { throwIfNoEntry: false })?.isDirectory() === true &&
    readdirSync(path).every((entry) => entry === STUB_FILENAME);

const writeStub = (view: NamespaceView, specifier: string, directory: string): void => {
    const path = join(view.viewDir, directory);

    if (!isStubDir(path)) {
        rmSync(path, { recursive: true, force: true });
    }

    mkdirSync(path, { recursive: true });
    writeFileIfChanged(join(path, STUB_FILENAME), stubSource(specifier));
};

const viewExport = (view: NamespaceView, name: string, key: string, target: unknown): unknown => {
    if (key === MANIFEST_EXPORT) {
        return target;
    }

    const directory = key.slice(2);

    if (view.namespaces.has(directory)) {
        linkNamespace(view, directory);

        return target;
    }

    writeStub(view, `${name}/${directory}`, directory);

    return { types: `./${directory}/${STUB_FILENAME}` };
};

const removeStaleEntries = (viewDir: string, exports: Record<string, unknown>): void => {
    for (const entry of readdirSync(viewDir)) {
        if (!entry.startsWith(".") && entry !== MANIFEST_FILENAME && !Object.hasOwn(exports, `./${entry}`)) {
            rmSync(join(viewDir, entry), { recursive: true, force: true });
        }
    }
};

const writeNamespaceView = (view: NamespaceView): void => {
    const manifest = storeManifestSchema.safeParse(readJsonFile(join(view.storeDir, MANIFEST_FILENAME))).data;

    if (manifest === undefined) {
        return;
    }

    if (lstatSync(view.viewDir, { throwIfNoEntry: false })?.isDirectory() !== true) {
        rmSync(view.viewDir, { recursive: true, force: true });
    }

    mkdirSync(view.viewDir, { recursive: true });
    const exports = Object.fromEntries(
        Object.entries(manifest.exports).map(([key, target]) => [key, viewExport(view, manifest.name, key, target)]),
    );
    writeFileIfChanged(join(view.viewDir, MANIFEST_FILENAME), `${JSON.stringify({ ...manifest, exports }, null, 2)}\n`);
    removeStaleEntries(view.viewDir, exports);
};

/**
 * Gives a project that shares stores written into another `node_modules` a view of them in its own: a package
 * exporting the namespaces of the project's libraries and their GIR dependencies, linked to the shared bindings,
 * with declaration-only stubs for the other namespaces so the project cannot import them.
 */
const writeStoreView = (gi: ViewedStore, jsx: ViewedStore | null, owner: string, project: SharedProject): void => {
    const includes = readNamespaceIncludes(gi.storeDir);

    if (includes === null) {
        return;
    }

    const namespaces = viewNamespaces(includes, project.libraries);

    for (const store of jsx === null ? [gi] : [gi, jsx]) {
        const viewDir = storeViewDir(owner, store);

        if (viewDir !== null) {
            writeNamespaceView({ storeDir: store.storeDir, viewDir, namespaces });
        }
    }
};

/**
 * Updates the views of the projects sharing stores, after their bindings or the libraries they share changed. A
 * recorded project whose packages no longer resolve these stores keeps its own.
 */
const writeSharedStoreViews = (gi: ViewedStore, jsx: ViewedStore | null, projects: [string, SharedProject][]): void => {
    const nodeModules = dirname(dirname(gi.storeDir));

    for (const [root, project] of projects) {
        if (resolvesStoreIn(root, nodeModules)) {
            writeStoreView(gi, jsx, root, project);
        }
    }
};

/** Restores a project's views of the stores it shares when they are missing, as after a package install. */
const ensureStoreViews = (owner: string, gi: ViewedStore, jsx: ViewedStore | null): void => {
    const isMissing = [gi, jsx].some((store) => {
        const viewDir = store === null ? null : storeViewDir(owner, store);

        return viewDir !== null && !existsSync(join(viewDir, MANIFEST_FILENAME));
    });
    const project = isMissing ? readSharedProject(gi.storeDir, owner) : undefined;

    if (project !== undefined) {
        writeStoreView(gi, jsx, owner, project);
    }
};

export { ensureStoreViews, storeViewDir, writeSharedStoreViews };
