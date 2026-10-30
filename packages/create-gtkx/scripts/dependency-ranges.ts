import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { minVersion } from "semver";
import { parse } from "yaml";

type Manifest = {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    engines?: Record<string, string>;
};

type Workspace = {
    catalog?: Record<string, string>;
    catalogs?: Record<string, Record<string, string>>;
};

const packageRoot = join(import.meta.dirname, "..");
const workspaceRoot = join(packageRoot, "../..");

const readManifest = (directory: string): Manifest =>
    JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as Manifest;

const workspace = parse(readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8")) as Workspace;

const declared = (ranges: Record<string, string> | undefined, name: string, owner: string): string => {
    const range = ranges?.[name];

    if (range === undefined) {
        throw new Error(`${owner} does not declare ${name}`);
    }

    if (!range.startsWith("catalog:")) {
        return range;
    }

    const catalogName = range.slice("catalog:".length);
    const catalog =
        catalogName === "" || catalogName === "default" ? workspace.catalog : workspace.catalogs?.[catalogName];
    const resolved = catalog?.[name];

    if (resolved === undefined) {
        throw new Error(`The ${range} catalog does not list ${name}`);
    }

    return resolved;
};

const lowestVersion = (range: string, owner: string) => {
    const version = minVersion(range);

    if (version === null) {
        throw new Error(`${owner} declares an unsatisfiable range ${range}`);
    }

    return version;
};

const supportedMajor = (range: string, owner: string): string => `^${lowestVersion(range, owner).version}`;

const peerRange = (packageName: string, name: string): string => {
    const owner = `@gtkx/${packageName}`;

    return supportedMajor(
        declared(readManifest(join(workspaceRoot, "packages", packageName)).peerDependencies, name, owner),
        owner,
    );
};

const nodeRange = declared(readManifest(packageRoot).engines, "node", "create-gtkx");

const ranges = {
    react: peerRange("react", "react"),
    "@types/react": peerRange("react", "@types/react"),
    vitest: peerRange("testing", "vitest"),
    vite: declared(readManifest(join(workspaceRoot, "packages/cli")).dependencies, "vite", "@gtkx/cli"),
    "@types/node": `^${String(lowestVersion(nodeRange, "create-gtkx").major)}`,
};

writeFileSync(join(packageRoot, "dependency-ranges.json"), `${JSON.stringify(ranges, null, 4)}\n`);
