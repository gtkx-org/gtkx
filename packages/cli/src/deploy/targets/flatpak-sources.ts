import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { DeploySettings } from "../types.js";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { gitRemoteUrl, runGit } from "../git.js";
import { optional } from "../nfpm/optional.js";

type PackageManager = "npm" | "pnpm" | "yarn";

type GitSource = {
    type: "git";
    url: string;
    tag?: string;
    commit?: string;
};

type GitRevision = {
    tag?: string;
    commit?: string;
};

const GENERATED_SOURCES = "generated-sources.json";
const GENERATOR = "flatpak-node-generator";
const FETCHABLE_URL = /^https?:\/\//;
const DEFAULT_NODE_EXTENSION = "org.freedesktop.Sdk.Extension.node24";
const NODE_EXTENSION_PREFIX = "org.freedesktop.Sdk.Extension.";
const SDK_EXTENSION_ROOT = "/usr/lib/sdk";

const LOCKFILE_BY_MANAGER: Record<PackageManager, string> = {
    npm: "package-lock.json",
    pnpm: "pnpm-lock.yaml",
    yarn: "yarn.lock",
};

const INSTALL_COMMAND: Record<PackageManager, string> = {
    npm: "npm ci --offline",
    pnpm: "pnpm install --offline --frozen-lockfile",
    yarn: "yarn install --offline",
};

const detectPackageManager = (settings: DeploySettings): PackageManager => {
    const configured = settings.deploy.flatpak?.packageManager;

    if (configured !== undefined) {
        return configured;
    }

    const found = (["pnpm", "yarn", "npm"] as const)
        .find((manager) => existsSync(join(settings.paths.root, LOCKFILE_BY_MANAGER[manager])));

    if (found === undefined) {
        throw new Error(
            "Cannot build a Flathub-ready manifest without a lockfile: the sandbox installs dependencies offline. " +
            "Commit a package-lock.json, pnpm-lock.yaml, or yarn.lock, or set `deploy.flatpak.packageManager`.",
        );
    }

    return found;
};

const installCommandFor = (manager: PackageManager): string => INSTALL_COMMAND[manager];

const nodeExtensionFor = (settings: DeploySettings): string =>
    settings.deploy.flatpak?.nodeExtension ?? DEFAULT_NODE_EXTENSION;

const nodeExtensionPathFor = (settings: DeploySettings): string => {
    const extension = nodeExtensionFor(settings);

    if (!extension.startsWith(NODE_EXTENSION_PREFIX)) {
        throw new Error(
            `Cannot resolve where "${extension}" mounts: the sandbox installs Node SDK extensions under ` +
            `${SDK_EXTENSION_ROOT}, so \`deploy.flatpak.nodeExtension\` has to be an ${NODE_EXTENSION_PREFIX}* id.`,
        );
    }

    return `${SDK_EXTENSION_ROOT}/${extension.slice(NODE_EXTENSION_PREFIX.length)}`;
};

const resolveSourceUrl = (settings: DeploySettings): string => {
    const url = settings.deploy.flatpak?.source?.url ?? gitRemoteUrl(settings.paths.root);

    if (url === null) {
        throw new Error(
            "Cannot build a Flathub-ready manifest without a public source: Flathub builds from a fetchable " +
            "repository, not from your working tree. Set `deploy.flatpak.source.url`.",
        );
    }

    if (!FETCHABLE_URL.test(url)) {
        throw new Error(
            `Cannot build a Flathub-ready manifest from "${url}": Flathub's builders clone over HTTPS and have no ` +
            "credentials, so an SSH remote never resolves there. Set `deploy.flatpak.source.url` to the " +
            "repository's https:// URL.",
        );
    }

    return url;
};

const configuredRevision = (settings: DeploySettings): GitRevision | null => {
    const source = settings.deploy.flatpak?.source ?? {};

    if (source.commit !== undefined) {
        return { ...optional("tag", source.tag), commit: source.commit };
    }

    return source.tag === undefined ? null : { tag: source.tag };
};

const workingTreeRevision = (settings: DeploySettings): GitRevision => {
    const root = settings.paths.root;

    return {
        ...optional("tag", runGit(root, ["describe", "--tags", "--exact-match"]) ?? undefined),
        ...optional("commit", runGit(root, ["rev-parse", "HEAD"]) ?? undefined),
    };
};

const resolveGitSource = (settings: DeploySettings): GitSource => ({
    type: "git",
    url: resolveSourceUrl(settings),
    ...(configuredRevision(settings) ?? workingTreeRevision(settings)),
});

const generatedSourcesPath = (settings: DeploySettings): string =>
    join(settings.paths.targets, "flatpak", GENERATED_SOURCES);

const isolateLockfile = (root: string, lockfile: string): string => {
    const source = join(root, lockfile);

    if (!existsSync(source)) {
        throw new Error(`Cannot vendor the offline sources: no ${lockfile} under ${root}`);
    }

    const manifest = join(dirname(source), "package.json");
    const dir = mkdtempSync(join(tmpdir(), "gtkx-lockfile-"));
    copyFileSync(existsSync(manifest) ? manifest : join(root, "package.json"), join(dir, "package.json"));
    copyFileSync(source, join(dir, basename(lockfile)));

    return dir;
};

const generateNodeSources = (settings: DeploySettings, manager: PackageManager): void => {
    const lockfile = settings.deploy.flatpak?.lockfile ?? LOCKFILE_BY_MANAGER[manager];
    const output = generatedSourcesPath(settings);
    mkdirSync(dirname(output), { recursive: true });
    const isolated = isolateLockfile(settings.paths.root, lockfile);

    try {
        runCliTool({
            tool: GENERATOR,
            args: [manager, join(isolated, basename(lockfile)), "-o", output],
            target: "the offline npm sources",
            shouldStream: true,
        });
    } finally {
        rmSync(isolated, { recursive: true, force: true, maxRetries: 5 });
    }
};

export {
    detectPackageManager,
    GENERATED_SOURCES,
    generateNodeSources,
    installCommandFor,
    nodeExtensionFor,
    nodeExtensionPathFor,
    type PackageManager,
    resolveGitSource,
};
