import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, request, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyNativeArtifacts } from "../../../../scripts/native-artifact.js";
import { startNxRegistry } from "../../../../scripts/nx-registry.js";

type HostNativeTarget = { triple: string; platformPackage: string };

type NativeManifest = {
    version: string;
    napi: { binaryName: string; targets: string[] };
    optionalDependencies: Record<string, string>;
};

type RunOptions = {
    cwd?: string | undefined;
    env?: NodeJS.ProcessEnv;
};

type RegistryContext = {
    env: NodeJS.ProcessEnv;
    registry: string;
    registryDir: string;
};

type RegistryHandle = RegistryContext & {
    npmrcPath: string;
    stop: () => Promise<void>;
};

type StartRegistryOptions = {
    registryDir: string;
    visibilityDelayMs?: number | undefined;
};

type PackageRoute = {
    kind: "packument" | "version";
    name: string;
};

type PackagePath = {
    name: string;
    remaining: string[];
};

type DelayedVisibility = "tag" | "version";

type VisibilityState = {
    advancedBeforeVisibility: boolean;
    name: string;
    packumentReleased: boolean;
    packumentWithheld: number;
    publishedAt: number;
    versionReleased: boolean;
    versionWithheld: number;
};

type VisibilityProxy = {
    assertDelay: () => void;
    server: Server;
};

type VisibilityTracker = {
    assertDelay: () => void;
    delayedResponse: (incoming: IncomingMessage, rawUrl: string) => DelayedVisibility | undefined;
    recordRequest: (incoming: IncomingMessage, rawUrl: string) => void;
    recordResponse: (incoming: IncomingMessage, rawUrl: string, status: number) => void;
};

type RegistryServers = {
    stop: () => Promise<void>;
    visibilityProxy?: VisibilityProxy | undefined;
};

type AppLaunch = {
    command: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
};

type HeadlessDisplay = typeof import("../../../vitest/src/headless-display.js");

const ROOT_DIR = fileURLToPath(new URL("../../../..", import.meta.url));
const PACKAGES_DIR = join(ROOT_DIR, "packages");
const NATIVE_DIR = join(ROOT_DIR, "packages", "native");
const PORT = 4873;
const VERDACCIO_PORT = 4874;
const HOSTNAME = "127.0.0.1";
const HOST = `${HOSTNAME}:${String(PORT)}`;
const REGISTRY = `http://${HOST}/`;

const hostNativeTargets: Record<string, HostNativeTarget> = {
    x64: { triple: "x86_64-unknown-linux-gnu", platformPackage: "@gtkx/native-linux-x64-gnu" },
    arm64: { triple: "aarch64-unknown-linux-gnu", platformPackage: "@gtkx/native-linux-arm64-gnu" },
};

const BUILT_APP_STABLE_MS = 8000;

function runAsync(command: string, args: string[], options: RunOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: "inherit" });
        child.on("error", reject);

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(
                    new Error(
                        `Command failed with exit code ${String(code ?? "unknown")}: ${command} ${args.join(" ")}`,
                    ),
                );
            }
        });
    });
}

function decodedPathSegments(rawUrl: string): string[] | undefined {
    try {
        const pathname = decodeURIComponent(new URL(rawUrl, REGISTRY).pathname);

        return pathname.split("/").filter((segment) => segment.length > 0);
    } catch {
        return undefined;
    }
}

function packagePath(segments: string[]): PackagePath | undefined {
    const first = segments[0];

    if (first === undefined || first.startsWith("-")) {
        return undefined;
    }

    if (!first.startsWith("@")) {
        return { name: first, remaining: segments.slice(1) };
    }

    const second = segments[1];

    return second === undefined ? undefined : { name: `${first}/${second}`, remaining: segments.slice(2) };
}

function packageRoute(rawUrl: string): PackageRoute | undefined {
    const segments = decodedPathSegments(rawUrl);
    const path = segments === undefined ? undefined : packagePath(segments);

    if (path === undefined || path.remaining.length > 1) {
        return undefined;
    }

    const remaining = path.remaining[0];

    if (remaining === undefined) {
        return { kind: "packument", name: path.name };
    }

    return remaining.startsWith("-") ? undefined : { kind: "version", name: path.name };
}

function delayedVisibility(
    incoming: IncomingMessage,
    route: PackageRoute | undefined,
    state: VisibilityState | undefined,
    delayMs: number,
): DelayedVisibility | undefined {
    if (state === undefined || incoming.method !== "GET" || route?.name !== state.name) {
        return undefined;
    }

    const elapsed = Date.now() - state.publishedAt;

    if (route.kind === "version") {
        if (elapsed < Math.ceil(delayMs / 2)) {
            state.versionWithheld += 1;

            return "version";
        }

        return undefined;
    }

    if (elapsed < delayMs) {
        state.packumentWithheld += 1;

        return "tag";
    }

    return undefined;
}

function proxyError(response: ServerResponse): void {
    if (!response.headersSent) {
        response.writeHead(502);
    }

    response.end();
}

function isSuccessfulStatus(status: number): boolean {
    return status >= 200 && status < 300;
}

function isPackagePublish(incoming: IncomingMessage, route: PackageRoute): boolean {
    return incoming.method === "PUT" && route.kind === "packument";
}

function newVisibilityState(route: PackageRoute): VisibilityState {
    return {
        advancedBeforeVisibility: false,
        name: route.name,
        packumentReleased: false,
        packumentWithheld: 0,
        publishedAt: Date.now(),
        versionReleased: false,
        versionWithheld: 0,
    };
}

function recordKnownVisibility(state: VisibilityState, incoming: IncomingMessage, route: PackageRoute): void {
    if (incoming.method !== "GET" || route.name !== state.name) {
        return;
    }

    if (route.kind === "version") {
        state.versionReleased = true;
    } else {
        state.packumentReleased = true;
    }
}

function recordVisibilityRequest(
    state: VisibilityState | undefined,
    incoming: IncomingMessage,
    route: PackageRoute | undefined,
): void {
    if (state !== undefined && route !== undefined && isPackagePublish(incoming, route) && route.name !== state.name) {
        state.advancedBeforeVisibility ||= !state.versionReleased || !state.packumentReleased;
    }
}

function recordVisibilityResponse(
    state: VisibilityState | undefined,
    incoming: IncomingMessage,
    route: PackageRoute | undefined,
    status: number,
): VisibilityState | undefined {
    if (route === undefined || !isSuccessfulStatus(status)) {
        return state;
    }

    if (state === undefined) {
        return isPackagePublish(incoming, route) ? newVisibilityState(route) : undefined;
    }

    recordKnownVisibility(state, incoming, route);

    return state;
}

function createVisibilityTracker(delayMs: number): VisibilityTracker {
    let state: VisibilityState | undefined;

    return {
        assertDelay: () => {
            if (
                state === undefined ||
                state.advancedBeforeVisibility ||
                state.versionWithheld === 0 ||
                state.packumentWithheld === 0 ||
                !state.versionReleased ||
                !state.packumentReleased
            ) {
                throw new Error("Publishing did not wait for delayed exact-version and dist-tag visibility");
            }

            console.log(`release-e2e: verified delayed registry visibility for ${state.name}`);
        },
        delayedResponse: (incoming, rawUrl) => delayedVisibility(incoming, packageRoute(rawUrl), state, delayMs),
        recordRequest: (incoming, rawUrl) => {
            recordVisibilityRequest(state, incoming, packageRoute(rawUrl));
        },
        recordResponse: (incoming, rawUrl, status) => {
            state = recordVisibilityResponse(state, incoming, packageRoute(rawUrl), status);
        },
    };
}

function forwardRegistryRequest(
    incoming: IncomingMessage,
    response: ServerResponse,
    rawUrl: string,
    tracker: VisibilityTracker,
): void {
    const upstream = request(
        {
            headers: { ...incoming.headers, host: HOST },
            hostname: HOSTNAME,
            method: incoming.method,
            path: rawUrl,
            port: VERDACCIO_PORT,
        },
        (upstreamResponse) => {
            const status = upstreamResponse.statusCode ?? 502;
            tracker.recordResponse(incoming, rawUrl, status);
            response.writeHead(status, upstreamResponse.headers);
            upstreamResponse.pipe(response);
        },
    );

    upstream.once("error", () => {
        proxyError(response);
    });
    incoming.pipe(upstream);
}

async function startVisibilityProxy(delayMs: number): Promise<VisibilityProxy> {
    const tracker = createVisibilityTracker(delayMs);
    const server = createServer((incoming, response) => {
        const rawUrl = incoming.url ?? "/";
        tracker.recordRequest(incoming, rawUrl);
        const delayedResponse = tracker.delayedResponse(incoming, rawUrl);

        if (delayedResponse !== undefined) {
            response.writeHead(delayedResponse === "version" ? 404 : 200, {
                "Cache-Control": "no-store",
                "Content-Type": "application/json",
            });
            response.end(delayedResponse === "version" ? "{}" : '{"dist-tags":{}}');

            return;
        }

        forwardRegistryRequest(incoming, response, rawUrl, tracker);
    });

    await listenServer(server, PORT);

    return { assertDelay: tracker.assertDelay, server };
}

function registryEnv(userConfig: string, registryDir: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        NX_WORKSPACE_DATA_DIRECTORY: join(registryDir, "nx-workspace-data"),
        NPM_CONFIG_CACHE: join(registryDir, "npm-cache"),
        NPM_CONFIG_REGISTRY: REGISTRY,
        NPM_CONFIG_USERCONFIG: userConfig,
        PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: "false",
        PNPM_CONFIG_REGISTRY: REGISTRY,
        PNPM_CONFIG_USERCONFIG: userConfig,
    };

    delete env.NODE_ENV;
    delete env.GITHUB_ACTIONS;
    delete env.NPM_CONFIG_PROVENANCE;
    delete env.npm_config_manage_package_manager_versions;
    delete env.pnpm_config_manage_package_manager_versions;

    return env;
}

const trackedFilesRewrittenByPublish = (): string[] => {
    const paths = [join(ROOT_DIR, "pnpm-lock.yaml"), join(NATIVE_DIR, "package.json")];
    const npmDir = join(NATIVE_DIR, "npm");

    if (!existsSync(npmDir)) {
        return paths;
    }

    for (const entry of readdirSync(npmDir)) {
        const manifest = join(npmDir, entry, "package.json");

        if (existsSync(manifest)) {
            paths.push(manifest);
        }
    }

    return paths;
};

const prepareHostOnlyPublish = (): (() => void) => {
    const host = hostNativeTargets[process.arch];

    if (host === undefined) {
        throw new Error(`release-e2e cannot stage native artifacts for architecture "${process.arch}"`);
    }

    const snapshot: Map<string, string> = new Map();

    for (const path of trackedFilesRewrittenByPublish()) {
        snapshot.set(path, readFileSync(path, "utf8"));
    }

    const manifestPath = join(NATIVE_DIR, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as NativeManifest;
    manifest.napi.targets = [host.triple];
    manifest.optionalDependencies = { [host.platformPackage]: manifest.version };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);

    return () => {
        for (const [path, content] of snapshot) {
            writeFileSync(path, content);
        }
    };
};

function stageNativeArtifacts(): void {
    const artifactsDir = join(NATIVE_DIR, "artifacts");

    if (process.env.GTKX_RELEASE_NATIVE_ARTIFACTS === "true") {
        verifyNativeArtifacts(artifactsDir, process.arch);

        return;
    }

    mkdirSync(artifactsDir, { recursive: true });

    for (const entry of readdirSync(NATIVE_DIR)) {
        if (entry.startsWith("native.") && entry.endsWith(".node")) {
            copyFileSync(join(NATIVE_DIR, entry), join(artifactsDir, entry));
        }
    }
}

async function publishPackages(env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("tsx", [join(ROOT_DIR, "scripts", "release.ts")], { cwd: ROOT_DIR, env });
}

function closeServer(server: Server): Promise<void> {
    return new Promise<void>((resolve) => {
        server.close(() => {
            resolve();
        });
    });
}

function listenServer(server: Server, port: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        server.once("error", reject);

        server.listen(port, HOSTNAME, () => {
            resolve();
        });
    });
}

async function publishInto(env: NodeJS.ProcessEnv): Promise<void> {
    stageNativeArtifacts();
    const restorePublishedTree = prepareHostOnlyPublish();

    try {
        await publishPackages(env);
    } finally {
        restorePublishedTree();
    }
}

async function startRegistryServers(registryDir: string, visibilityDelayMs: number): Promise<RegistryServers> {
    const stop = await startNxRegistry(registryDir, visibilityDelayMs > 0 ? VERDACCIO_PORT : PORT);

    try {
        if (visibilityDelayMs === 0) {
            return { stop };
        }

        return { stop, visibilityProxy: await startVisibilityProxy(visibilityDelayMs) };
    } catch (error) {
        await stop();
        throw error;
    }
}

async function stopRegistryServers(servers: RegistryServers): Promise<void> {
    try {
        if (servers.visibilityProxy !== undefined) {
            await closeServer(servers.visibilityProxy.server);
        }
    } finally {
        await servers.stop();
    }
}

async function startRegistry(options: StartRegistryOptions): Promise<RegistryHandle> {
    const { registryDir } = options;
    const visibilityDelayMs = options.visibilityDelayMs ?? 0;
    mkdirSync(registryDir, { recursive: true });
    const npmrcPath = join(registryDir, "npmrc");
    writeFileSync(npmrcPath, `registry=${REGISTRY}\n//${HOST}/:_authToken=secretVerdaccioToken\n`);
    const servers = await startRegistryServers(registryDir, visibilityDelayMs);

    try {
        const env = registryEnv(npmrcPath, registryDir);
        await publishInto(env);
        servers.visibilityProxy?.assertDelay();

        return {
            env,
            registry: REGISTRY,
            registryDir,
            npmrcPath,
            stop: () => stopRegistryServers(servers),
        };
    } catch (error) {
        await stopRegistryServers(servers);
        throw error;
    }
}

async function loadHeadlessDisplay(): Promise<HeadlessDisplay> {
    const modulePath = join(ROOT_DIR, "packages", "vitest", "dist", "headless-display.js");

    return (await import(pathToFileURL(modulePath).href)) as HeadlessDisplay;
}

function runBuiltAppUntilStable(appDir: string, env: NodeJS.ProcessEnv, launch: AppLaunch): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(launch.command, launch.args, {
            cwd: appDir,
            env,
            stdio: ["ignore", "pipe", "pipe"],
        });

        let output = "";

        const capture = (chunk: Buffer): void => {
            output += chunk.toString("utf8");
        };

        child.stdout.on("data", capture);
        child.stderr.on("data", capture);

        const timer = setTimeout(() => {
            child.removeAllListeners("exit");
            child.kill("SIGKILL");
            resolve();
        }, BUILT_APP_STABLE_MS);

        child.on("error", (cause) => {
            clearTimeout(timer);
            reject(cause);
        });

        child.on("exit", (code, signal) => {
            clearTimeout(timer);
            const command = [launch.command, ...launch.args].join(" ");

            reject(
                new Error(
                    `Built app "${command}" exited early (code ${String(code ?? "null")}, ` +
                        `signal ${signal ?? "null"}) before it was confirmed running:\n${output}`,
                ),
            );
        });
    });
}

async function verifyAppStarts(appDir: string, launch: AppLaunch): Promise<void> {
    const { startHeadlessDisplay, resolveHeadlessOptions, STATIC_HEADLESS_ENV } = await loadHeadlessDisplay();
    const teardown = await startHeadlessDisplay(resolveHeadlessOptions({}));

    try {
        await runBuiltAppUntilStable(appDir, { ...process.env, ...STATIC_HEADLESS_ENV, ...launch.env }, launch);
    } finally {
        teardown();
    }
}

async function verifyBuiltAppStarts(appDir: string): Promise<void> {
    await verifyAppStarts(appDir, { command: process.execPath, args: ["dist/bundle.mjs"] });
}

export {
    ROOT_DIR,
    PACKAGES_DIR,
    REGISTRY,
    runAsync,
    startRegistry,
    loadHeadlessDisplay,
    verifyAppStarts,
    verifyBuiltAppStarts,
    type RegistryContext,
};
