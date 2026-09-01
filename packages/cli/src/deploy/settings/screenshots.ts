import hostedGitInfo from "hosted-git-info";
import type { DeployConfig, DeployScreenshot } from "../types.js";
import { gitRemoteUrl, runGit } from "../git.js";

type ScreenshotRequest = {
    root: string;
    deploy: DeployConfig;
};

const DEFAULT_BRANCH = "main";
const TRAILING_SLASH = "/";

const readRepositoryPrefix = (root: string): string =>
    trimTrailingSlash(runGit(root, ["rev-parse", "--show-prefix"]) ?? "");

const trimTrailingSlash = (value: string): string =>
    value.endsWith(TRAILING_SLASH) ? trimTrailingSlash(value.slice(0, -1)) : value;

const trimLeadingSlash = (value: string): string => {
    const withoutDot = value.startsWith("./") ? value.slice(2) : value;

    return withoutDot.startsWith(TRAILING_SLASH) ? withoutDot.slice(1) : withoutDot;
};

const readDefaultBranch = (root: string): string => {
    const head = runGit(root, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);

    if (head === null || head.length === 0) {
        return DEFAULT_BRANCH;
    }

    const separator = head.indexOf(TRAILING_SLASH);

    return separator === -1 ? head : head.slice(separator + 1);
};

const baseForRemote = (root: string, remote: string): string | null => {
    const repository = hostedGitInfo.fromUrl(remote);

    if (repository === undefined || (repository.type !== "github" && repository.type !== "gitlab")) {
        return null;
    }

    return trimTrailingSlash(
        repository.file(readRepositoryPrefix(root), { committish: readDefaultBranch(root) }),
    );
};

const resolveScreenshotBaseUrl = ({ root, deploy }: ScreenshotRequest): string | null => {
    if (deploy.screenshotBaseUrl !== undefined) {
        return trimTrailingSlash(deploy.screenshotBaseUrl);
    }

    const remote = gitRemoteUrl(root);

    return remote === null ? null : baseForRemote(root, remote);
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
