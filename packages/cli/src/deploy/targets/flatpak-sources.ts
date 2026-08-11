import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
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

const GENERATED_SOURCES = "generated-sources.json";
const GENERATOR = "flatpak-node-generator";
const FETCHABLE_URL = /^https?:\/\//;

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

const resolveGitSource = (settings: DeploySettings): GitSource => {
    const configured = settings.deploy.flatpak?.source ?? {};
    const root = settings.paths.root;
    const tag = configured.tag ?? runGit(root, ["describe", "--tags", "--exact-match"]) ?? undefined;
    const commit = configured.commit ?? runGit(root, ["rev-parse", "HEAD"]) ?? undefined;

    return {
        type: "git",
        url: resolveSourceUrl(settings),
        ...optional("tag", tag),
        ...optional("commit", commit),
    };
};

const generatedSourcesPath = (settings: DeploySettings): string =>
    join(settings.paths.targets, "flatpak", GENERATED_SOURCES);

const generateNodeSources = (settings: DeploySettings, manager: PackageManager): void => {
    const lockfile = settings.deploy.flatpak?.lockfile ?? LOCKFILE_BY_MANAGER[manager];
    const output = generatedSourcesPath(settings);
    mkdirSync(dirname(output), { recursive: true });

    runCliTool({
        tool: GENERATOR,
        args: [manager, join(settings.paths.root, lockfile), "-o", output],
        target: "the offline npm sources",
        shouldStream: true,
    });
};

export {
    detectPackageManager,
    GENERATED_SOURCES,
    generateNodeSources,
    installCommandFor,
    resolveGitSource,
};
