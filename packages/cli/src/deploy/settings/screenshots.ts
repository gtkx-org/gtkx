import { tryResolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import type { DeployConfig, DeployScreenshot } from "../types.js";

type ScreenshotRequest = {
    root: string;
    deploy: DeployConfig;
};

type RemoteParts = {
    host: string;
    owner: string;
    repo: string;
};

const DEFAULT_BRANCH = "main";
const GIT_SUFFIX = ".git";
const SCHEME_SEPARATOR = "://";
const TRAILING_SLASH = "/";

const RAW_BASE_BY_HOST: Record<string, (owner: string, repo: string) => string> = {
    "github.com": (owner, repo) => `https://raw.githubusercontent.com/${owner}/${repo}/${DEFAULT_BRANCH}`,
    "gitlab.com": (owner, repo) => `https://gitlab.com/${owner}/${repo}/-/raw/${DEFAULT_BRANCH}`,
};

const runGit = (root: string, args: string[]): string | null => {
    const git = tryResolveExecutable("git");

    if (git === undefined) {
        return null;
    }

    try {
        return execFileSync(git, args, { cwd: root, encoding: "utf8" }).trim();
    } catch {
        return null;
    }
};

const readOriginUrl = (root: string): string | null => runGit(root, ["remote", "get-url", "origin"]);

const readRepositoryPrefix = (root: string): string =>
    trimTrailingSlash(runGit(root, ["rev-parse", "--show-prefix"]) ?? "");

const trimTrailingSlash = (value: string): string =>
    value.endsWith(TRAILING_SLASH) ? trimTrailingSlash(value.slice(0, -1)) : value;

const trimLeadingSlash = (value: string): string => {
    const withoutDot = value.startsWith("./") ? value.slice(2) : value;

    return withoutDot.startsWith(TRAILING_SLASH) ? withoutDot.slice(1) : withoutDot;
};

const afterMarker = (value: string, marker: string): string => {
    const index = value.indexOf(marker);

    return index === -1 ? value : value.slice(index + marker.length);
};

const parseRemote = (remote: string): RemoteParts | null => {
    const trimmed = remote.endsWith(GIT_SUFFIX) ? remote.slice(0, -GIT_SUFFIX.length) : remote;
    const location = afterMarker(afterMarker(trimmed, SCHEME_SEPARATOR), "@").replace(":", "/");
    const [host, owner, repo, ...extra] = location.split("/");

    if (repo === undefined || extra.length > 0) {
        return null;
    }

    return { host: host ?? "", owner: owner ?? "", repo };
};

const baseForRemote = (remote: string): string | null => {
    const parts = parseRemote(remote);

    if (parts === null) {
        return null;
    }

    const build = RAW_BASE_BY_HOST[parts.host];

    return build === undefined ? null : build(parts.owner, parts.repo);
};

const resolveScreenshotBaseUrl = ({ root, deploy }: ScreenshotRequest): string | null => {
    if (deploy.screenshotBaseUrl !== undefined) {
        return trimTrailingSlash(deploy.screenshotBaseUrl);
    }

    const remote = readOriginUrl(root);
    const base = remote === null ? null : baseForRemote(remote);
    const prefix = base === null ? "" : readRepositoryPrefix(root);

    return base === null || prefix.length === 0 ? base : `${base}/${prefix}`;
};

const urlForScreenshot = (file: string, baseUrl: string | null): string => {
    if (baseUrl === null) {
        throw new Error(
            `Cannot turn the screenshot "${file}" into a URL: a software center fetches screenshots over the ` +
            "network. Set `deploy.screenshotBaseUrl`, or give the screenshot an absolute `url`.",
        );
    }

    return `${baseUrl}/${trimLeadingSlash(file)}`;
};

const resolveScreenshots = (request: ScreenshotRequest): DeployScreenshot[] => {
    const configured = request.deploy.screenshots ?? [];

    if (configured.length === 0) {
        return [];
    }

    const baseUrl = resolveScreenshotBaseUrl(request);
    const defaultIndex = configured.findIndex((entry) => entry.isDefault === true);

    return configured.map((entry, index) => ({
        url: entry.url ?? urlForScreenshot(entry.file ?? "", baseUrl),
        caption: entry.caption ?? null,
        isDefault: index === defaultIndex,
    }));
};

export { resolveScreenshots };
