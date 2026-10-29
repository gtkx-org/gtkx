import {
    cpSync,
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempDisposableSync,
    readdirSync,
    readFileSync,
    realpathSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

type Manifest = { name: string; private?: boolean; files?: string[] };

const workspace = fileURLToPath(new URL("../../..", import.meta.url));
const createProject = (config: Record<string, unknown> = {}) => {
    const directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-cli-test-"));
    const root = directory.path;
    const write = (path: string, content: string) => {
        const target = join(root, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
    };
    mkdirSync(join(root, "node_modules/@gtkx"), { recursive: true });
    for (const name of [
        "cairo",
        "cli",
        "components",
        "config",
        "css",
        "i18n",
        "native",
        "react",
        "runtime",
        "storybook",
        "testing",
        "utils",
        "vitest",
    ]) {
        symlinkSync(join(workspace, "packages", name), join(root, "node_modules/@gtkx", name), "dir");
    }
    for (const name of ["@types", "react", "csstype", "tsx", "vitest"]) {
        symlinkSync(join(workspace, "node_modules", name), join(root, "node_modules", name), "dir");
    }
    write(
        "package.json",
        JSON.stringify({ name: "cli-example", version: "1.0.0", type: "module", license: "MIT", dependencies: {} }),
    );
    write(
        "gtkx.config.ts",
        `export default ${JSON.stringify({ applicationId: "org.gtkx.example", codegen: false, agents: { reference: false, rules: false }, ...config })};`,
    );
    write("src/index.ts", 'export const greeting = "hello from build";');
    return { root, write, [Symbol.dispose]: () => directory[Symbol.dispose]() };
};

const linkWorkspaceBindings = (root: string) => {
    for (const name of ["gi", "jsx"]) {
        symlinkSync(join(workspace, "node_modules/.gtkx", name), join(root, "node_modules/@gtkx", name), "dir");
    }
};

const readManifest = (directory: string): Manifest =>
    JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as Manifest;

const link = (target: string, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    symlinkSync(relative(dirname(path), target), path, "dir");
};

const installedEntries = (modules: string): string[] =>
    existsSync(modules)
        ? readdirSync(modules)
              .filter((entry) => !entry.startsWith("."))
              .flatMap((entry) =>
                  entry.startsWith("@") ? readdirSync(join(modules, entry)).map((name) => `${entry}/${name}`) : [entry],
              )
        : [];

const APP_PACKAGES = ["cairo", "cli", "config", "css", "mcp", "react", "runtime", "testing"];
const LINKED_PACKAGES: Set<string> = new Set(["@gtkx/native"]);
const GENERATED_PACKAGES: Set<string> = new Set(["@gtkx/gi", "@gtkx/jsx"]);

/**
 * A pnpm workspace with pnpm's default isolated layout: every published GTKX package is copied once into
 * `node_modules/.pnpm/<id>/node_modules`, beside links to its own dependencies, and each app links only its
 * direct dependencies.
 */
const createPnpmWorkspace = (apps: Record<string, Record<string, unknown>>) => {
    const directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-cli-pnpm-"));
    const root = directory.path;
    const write = (path: string, content: string) => {
        const target = join(root, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
    };
    const sources: Map<string, string> = new Map(
        readdirSync(join(workspace, "packages"))
            .map((entry) => join(workspace, "packages", entry))
            .filter((source) => existsSync(join(source, "package.json")) && readManifest(source).private !== true)
            .map((source) => [readManifest(source).name, source]),
    );
    const virtualPath = (name: string) =>
        join(root, "node_modules/.pnpm", `${name.replace("/", "+")}@0.0.0`, "node_modules", name);

    for (const [name, source] of sources) {
        const target = virtualPath(name);

        if (LINKED_PACKAGES.has(name)) {
            link(source, target);
            continue;
        }

        mkdirSync(target, { recursive: true });
        cpSync(join(source, "package.json"), join(target, "package.json"));

        for (const entry of readManifest(source).files ?? []) {
            if (!entry.startsWith("!") && existsSync(join(source, entry))) {
                cpSync(join(source, entry), join(target, entry), { recursive: true });
            }
        }

        for (const dependency of installedEntries(join(source, "node_modules"))) {
            if (GENERATED_PACKAGES.has(dependency)) {
                continue;
            }

            const sibling = join(dirname(target), relative(dirname(name), dependency));
            const internal = sources.has(dependency) ? virtualPath(dependency) : null;

            if (lstatSync(sibling, { throwIfNoEntry: false }) === undefined) {
                link(internal ?? realpathSync(join(source, "node_modules", dependency)), sibling);
            }
        }
    }

    const linkApp = (app: string) => {
        for (const name of APP_PACKAGES) {
            link(virtualPath(`@gtkx/${name}`), join(root, app, "node_modules/@gtkx", name));
        }

        for (const name of ["@types/react", "@types/node", "react", "vitest"]) {
            link(realpathSync(join(workspace, "node_modules", name)), join(root, app, "node_modules", name));
        }
    };

    write("package.json", JSON.stringify({ name: "studio", private: true, type: "module" }));
    write("pnpm-workspace.yaml", "packages:\n  - apps/*\n  - packages/*\n");

    for (const [app, config] of Object.entries(apps)) {
        write(`apps/${app}/package.json`, JSON.stringify({ name: app, version: "1.0.0", type: "module" }));
        write(
            `apps/${app}/gtkx.config.ts`,
            `export default ${JSON.stringify({ agents: { reference: false, rules: false }, ...config })};`,
        );
        linkApp(`apps/${app}`);
    }

    return {
        root,
        write,
        linkApp,
        cli: (app: string) => join(root, "apps", app, "node_modules/@gtkx/cli/bin/gtkx.js"),
        tsc: join(workspace, "node_modules/.bin/tsc"),
        [Symbol.dispose]: () => directory[Symbol.dispose](),
    };
};

export { createPnpmWorkspace, createProject, linkWorkspaceBindings };
