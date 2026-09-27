import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gt, valid } from "semver";
import { packageIdentity, registryFor, visibilityTimeoutMs, waitForVisibility } from "./pnpm-publish.js";
import { distTagForVersion } from "./publish-manifest.js";

type ReleasePackage = {
    directory: string;
    name: string;
    version: string;
    registry: URL;
    tag: string;
};

const releasePackages = (directories: string[]): ReleasePackage[] => {
    const packages = directories.map((directory) => {
        const { name, version, manifest } = packageIdentity(directory);

        if (valid(version) === null) {
            throw new Error(`Invalid release version for ${name}`);
        }

        return {
            directory, name, version, registry: registryFor(directory, name, manifest), tag: distTagForVersion(version),
        };
    });

    if (packages.length === 0 || new Set(packages.map(({ version }) => version)).size !== 1) {
        throw new Error("A release must contain one complete fixed-version package set");
    }

    return packages;
};

const currentChannelVersion = async (entry: ReleasePackage): Promise<unknown> => {
    const response = await fetch(new URL(encodeURIComponent(entry.name), entry.registry), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 404) {
        return undefined;
    }

    if (!response.ok) {
        throw new Error(`Cannot inspect release channel: HTTP ${String(response.status)}`);
    }

    const document = await response.json() as { "dist-tags"?: Record<string, unknown> };

    return document["dist-tags"]?.[entry.tag];
};

const assertChannelCanAdvance = async (packages: ReleasePackage[]): Promise<void> => {
    for (const entry of packages) {
        const current = await currentChannelVersion(entry);

        if (current === undefined) {
            continue;
        }

        if (typeof current !== "string" || valid(current) === null || gt(current, entry.version)) {
            throw new Error(`Release would move ${entry.name}'s ${entry.tag} channel backwards`);
        }
    }
};

const oidcPublishToken = async (entry: ReleasePackage): Promise<string | undefined> => {
    if (process.env.GITHUB_ACTIONS !== "true") {
        return undefined;
    }

    if (entry.registry.href !== "https://registry.npmjs.org/") {
        throw new Error("Release promotion requires the npm trusted publishing registry");
    }

    const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

    if (requestUrl === undefined || requestToken === undefined) {
        throw new Error("Release promotion requires OIDC authentication");
    }

    const url = new URL(requestUrl);
    url.searchParams.set("audience", "npm:registry.npmjs.org");
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${requestToken}` },
        signal: AbortSignal.timeout(10_000),
    });
    const document = await response.json() as { value?: unknown };

    if (!response.ok || typeof document.value !== "string") {
        throw new Error(`OIDC token request failed: HTTP ${String(response.status)}`);
    }

    const exchangePath = `-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(entry.name)}`;
    const exchangeUrl = new URL(exchangePath, entry.registry);
    const exchange = await fetch(exchangeUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${document.value}` },
        signal: AbortSignal.timeout(10_000),
    });
    const result = await exchange.json() as { token?: unknown };

    if (!exchange.ok || typeof result.token !== "string" || /[\r\n]/.test(result.token)) {
        throw new Error(`npm token exchange failed: HTTP ${String(exchange.status)}`);
    }

    return result.token;
};

const promotePackage = async (entry: ReleasePackage): Promise<void> => {
    const token = await oidcPublishToken(entry);
    const temporary = mkdtempSync(join(tmpdir(), "gtkx-promotion-"));

    try {
        const env = { ...process.env };

        if (token !== undefined) {
            const config = join(temporary, "npmrc");
            writeFileSync(config, `//registry.npmjs.org/:_authToken=${token}\n`, { mode: 0o600 });
            env.NPM_CONFIG_USERCONFIG = config;
        }

        execFileSync(resolveExecutable("npm"), [
            "dist-tag", "add", `${entry.name}@${entry.version}`, entry.tag, "--registry", entry.registry.href,
        ], { cwd: temporary, env, stdio: "inherit" });
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
};

const checkReleaseChannel = async (directories: string[]): Promise<void> => {
    await assertChannelCanAdvance(releasePackages(directories));
};

const promoteRelease = async (directories: string[]): Promise<void> => {
    const packages = releasePackages(directories);
    const timeoutMs = visibilityTimeoutMs();
    await assertChannelCanAdvance(packages);

    for (const entry of packages) {
        await waitForVisibility(entry.directory, undefined, timeoutMs);
    }

    await assertChannelCanAdvance(packages);

    for (const entry of packages) {
        await assertChannelCanAdvance([entry]);
        await promotePackage(entry);
    }

    for (const entry of packages) {
        await waitForVisibility(entry.directory, entry.tag, timeoutMs);
    }
};

export { checkReleaseChannel, promoteRelease };
