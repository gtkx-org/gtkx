import type { Server } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
    copyFileSync,
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runServer } from "verdaccio";

type HostNativeTarget = { triple: string; platformPackage: string; binary: string; cpu: string };

type NativeManifest = {
    version: string;
    napi: { binaryName: string; targets: string[] };
    optionalDependencies: Record<string, string>;
};

type UserResponse = {
    token?: string;
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
    registryDir?: string | undefined;
    resetsStorage?: boolean | undefined;
};

type AppLaunch = {
    command: string;
    args: string[];
};

type HeadlessDisplay = {
    startHeadlessDisplay: (options: { size: string; compositor: "sway" | "weston" }) => Promise<() => void>;
    resolveHeadlessOptions: (provided: object) => { size: string; compositor: "sway" | "weston" };
    STATIC_HEADLESS_ENV: Record<string, string>;
};

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
const PACKAGES_DIR = join(ROOT_DIR, "packages");
const NATIVE_DIR = join(ROOT_DIR, "packages", "native");
const PORT = 4873;
const HOST = `localhost:${String(PORT)}`;
const REGISTRY = `http://${HOST}/`;
const REGISTRAR_USER = "release-e2e";

const hostNativeTargets: Record<string, HostNativeTarget> = {
    x64: {
        triple: "x86_64-unknown-linux-gnu",
        platformPackage: "@gtkx/native-linux-x64-gnu",
        binary: "native.linux-x64-gnu.node",
        cpu: "x64",
    },
    arm64: {
        triple: "aarch64-unknown-linux-gnu",
        platformPackage: "@gtkx/native-linux-arm64-gnu",
        binary: "native.linux-arm64-gnu.node",
        cpu: "arm64",
    },
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

function verdaccioConfig(workDir: string): string {
    return `
        storage: ${join(workDir, "storage")}
        auth:
            htpasswd:
                file: ${join(workDir, "htpasswd")}
                max_users: 1000
        uplinks:
            npmjs:
                url: https://registry.npmjs.org/
                maxage: 60m
                cache: true
        packages:
            '@gtkx/*':
                access: $all
                publish: $all
                unpublish: $all
            'create-gtkx':
                access: $all
                publish: $all
                unpublish: $all
            '@*/*':
                access: $all
                publish: $all
                proxy: npmjs
            '**':
                access: $all
                publish: $all
                proxy: npmjs
        security:
            api:
                jwt:
                    sign:
                        expiresIn: 1d
            web:
                sign:
                    expiresIn: 1d
        listen: ${HOST}
        log:
            type: stdout
            format: pretty
            level: warn
    `;
}

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether the registry answered */
async function ping(): Promise<boolean> {
    try {
        const response = await fetch(`${REGISTRY}-/ping`);

        return response.ok;
    } catch {
        return false;
    }
}

async function waitForRegistry(): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (await ping()) {
            return;
        }

        await delay(500);
    }

    throw new Error("Verdaccio did not become ready in time");
}

async function createUserToken(): Promise<string> {
    const response = await fetch(`${REGISTRY}-/user/org.couchdb.user:${REGISTRAR_USER}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: REGISTRAR_USER, password: REGISTRAR_USER, email: "e2e@gtkx.dev" }),
    });

    if (!response.ok) {
        throw new Error(`Failed to register Verdaccio user: HTTP ${String(response.status)}`);
    }

    const body = (await response.json()) as UserResponse;

    if (!body.token) {
        throw new Error("Verdaccio did not return an authentication token");
    }

    return body.token;
}

function registryEnv(userConfig: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        NPM_CONFIG_REGISTRY: REGISTRY,
        NPM_CONFIG_USERCONFIG: userConfig,
    };

    delete env.NPM_CONFIG_PROVENANCE;

    return env;
}

const trackedFilesRewrittenByPublish = (): string[] => {
    return [join(ROOT_DIR, "pnpm-lock.yaml"), join(NATIVE_DIR, "package.json")];
};

const isolateDirectory = (path: string, backupName: string): (() => void) => {
    const backupPath = join(NATIVE_DIR, `.${backupName}-${randomUUID()}`);
    const didExist = lstatSync(path, { throwIfNoEntry: false }) !== undefined;

    if (didExist) {
        renameSync(path, backupPath);
    }

    return () => {
        rmSync(path, { recursive: true, force: true });

        if (didExist) {
            renameSync(backupPath, path);
        }
    };
};

const rootNativeBinaries = (): string[] =>
    readdirSync(NATIVE_DIR).filter((entry) => entry.startsWith("native.") && entry.endsWith(".node"));

const moveNativeBinaries = (sourceDir: string, destinationDir: string, binaries: string[]): void => {
    for (const binary of binaries) {
        renameSync(join(sourceDir, binary), join(destinationDir, binary));
    }
};

const restoreRootNativeBinaries = (backupPath: string, binaries: string[]): void => {
    for (const binary of rootNativeBinaries()) {
        rmSync(join(NATIVE_DIR, binary), { force: true });
    }

    moveNativeBinaries(backupPath, NATIVE_DIR, binaries);
    rmSync(backupPath, { recursive: true, force: true });
};

const snapshotRootNativeBinaries = (): (() => void) => {
    const backupPath = join(NATIVE_DIR, `.release-e2e-native-binaries-${randomUUID()}`);
    const binaries = rootNativeBinaries();
    const moved: string[] = [];
    mkdirSync(backupPath);

    try {
        for (const binary of binaries) {
            renameSync(join(NATIVE_DIR, binary), join(backupPath, binary));
            moved.push(binary);
        }
    } catch (error) {
        moveNativeBinaries(backupPath, NATIVE_DIR, moved);
        rmSync(backupPath, { recursive: true, force: true });
        throw error;
    }

    return () => {
        restoreRootNativeBinaries(backupPath, binaries);
    };
};

const hostNativeTarget = (): HostNativeTarget => {
    const host = hostNativeTargets[process.arch];

    if (host === undefined) {
        throw new Error(`release-e2e cannot stage native artifacts for architecture "${process.arch}"`);
    }

    return host;
};

const prepareHostOnlyPublish = (): (() => void) => {
    const host = hostNativeTarget();
    const snapshot: Map<string, string> = new Map();

    for (const path of trackedFilesRewrittenByPublish()) {
        snapshot.set(path, readFileSync(path, "utf8"));
    }

    const restore = (): void => {
        for (const [path, content] of snapshot) {
            writeFileSync(path, content);
        }
    };

    const manifestPath = join(NATIVE_DIR, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as NativeManifest;
    manifest.napi.targets = [host.triple];
    manifest.optionalDependencies = { [host.platformPackage]: manifest.version };

    try {
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
    } catch (error) {
        restore();
        throw error;
    }

    return restore;
};

async function stageNativeArtifacts(): Promise<() => void> {
    await runAsync("nx", ["run", "@gtkx/native:build"], { env: process.env });
    const host = hostNativeTarget();
    const binaryPath = join(NATIVE_DIR, host.binary);

    if (!existsSync(binaryPath)) {
        throw new Error(`Native build did not produce ${host.binary}`);
    }

    const artifactsDir = join(NATIVE_DIR, "artifacts");
    const restore = isolateDirectory(artifactsDir, "release-e2e-artifacts");

    try {
        mkdirSync(artifactsDir, { recursive: true });
        copyFileSync(binaryPath, join(artifactsDir, host.binary));

        return restore;
    } catch (error) {
        restore();
        throw error;
    }
}

async function publishPackages(env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("nx", ["run-many", "-t", "release"], { env });
}

function closeServer(server: Server): Promise<void> {
    return new Promise<void>((resolve) => {
        server.close(() => {
            resolve();
        });
    });
}

function listenServer(server: Server): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => {
            reject(error);
        };

        server.once("error", onError);

        server.listen(PORT, () => {
            server.off("error", onError);
            resolve();
        });
    });
}

async function publishInto(env: NodeJS.ProcessEnv): Promise<void> {
    const restoreNativeBinaries = snapshotRootNativeBinaries();

    try {
        const restoreArtifacts = await stageNativeArtifacts();

        try {
            const restoreNpmTree = isolateDirectory(join(NATIVE_DIR, "npm"), "release-e2e-npm");

            try {
                const restorePublishedTree = prepareHostOnlyPublish();

                try {
                    await publishPackages(env);
                } finally {
                    restorePublishedTree();
                }
            } finally {
                restoreNpmTree();
            }
        } finally {
            restoreArtifacts();
        }
    } finally {
        restoreNativeBinaries();
    }
}

const prepareRegistryDirectory = (registryDir: string, shouldResetStorage: boolean): void => {
    mkdirSync(registryDir, { recursive: true });
    writeFileSync(join(registryDir, "config.yaml"), verdaccioConfig(registryDir));
    rmSync(join(registryDir, "htpasswd"), { force: true });

    if (shouldResetStorage) {
        rmSync(join(registryDir, "storage"), { recursive: true, force: true });
    }
};

const cleanupFailedRegistry = async (
    server: Server | undefined,
    registryDir: string,
    isRegistryDirOwned: boolean,
): Promise<void> => {
    try {
        if (server !== undefined) {
            await closeServer(server);
        }
    } finally {
        if (isRegistryDirOwned) {
            rmSync(registryDir, { recursive: true, force: true });
        }
    }
};

async function startRegistry(options: StartRegistryOptions = {}): Promise<RegistryHandle> {
    const isRegistryDirOwned = options.registryDir === undefined;
    const registryDir = options.registryDir ?? mkdtempSync(join(tmpdir(), "gtkx-registry-"));
    const configPath = join(registryDir, "config.yaml");
    const npmrcPath = join(registryDir, "npmrc");
    let server: Server | undefined;

    try {
        prepareRegistryDirectory(registryDir, options.resetsStorage ?? true);
        server = (await runServer(configPath)) as Server;
        await listenServer(server);
        await waitForRegistry();
        const token = await createUserToken();
        writeFileSync(npmrcPath, `registry=${REGISTRY}\n//${HOST}/:_authToken=${token}\n`);
        const env = registryEnv(npmrcPath);
        await publishInto(env);
        const activeServer = server;

        return { env, registry: REGISTRY, registryDir, npmrcPath, stop: () => closeServer(activeServer) };
    } catch (error) {
        await cleanupFailedRegistry(server, registryDir, isRegistryDirOwned);
        throw error;
    }
}

async function withRegistry(fn: (ctx: RegistryContext) => Promise<void>): Promise<void> {
    const handle = await startRegistry();

    try {
        await fn(handle);
    } finally {
        try {
            await handle.stop();
        } finally {
            rmSync(handle.registryDir, { recursive: true, force: true });
        }
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
        await runBuiltAppUntilStable(appDir, { ...process.env, ...STATIC_HEADLESS_ENV }, launch);
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
    hostNativeTarget,
    runAsync,
    startRegistry,
    withRegistry,
    verifyAppStarts,
    verifyBuiltAppStarts,
    type RegistryContext,
};
