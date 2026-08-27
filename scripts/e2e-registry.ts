import type { Server } from "node:http";
import { spawn } from "node:child_process";
import {
    copyFileSync,
    type Dirent,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runServer } from "verdaccio";

type HostNativeTarget = { triple: string; platformPackage: string };

type NativeManifest = {
    version: string;
    napi: { binaryName: string; targets: string[] };
    optionalDependencies: Record<string, string>;
};

type PackageIdentity = {
    name?: string;
    private?: boolean;
};

type PublishablePackage = {
    directory: string;
    name: string;
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
    env?: NodeJS.ProcessEnv;
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

async function stageNativeArtifacts(): Promise<void> {
    await runAsync("nx", ["run", "@gtkx/native:build"], { env: process.env });
    const artifactsDir = join(NATIVE_DIR, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    for (const entry of readdirSync(NATIVE_DIR)) {
        if (entry.startsWith("native.") && entry.endsWith(".node")) {
            copyFileSync(join(NATIVE_DIR, entry), join(artifactsDir, entry));
        }
    }
}

function publishablePackage(entry: Dirent): PublishablePackage[] {
    if (!entry.isDirectory()) {
        return [];
    }

    const packageDir = join(PACKAGES_DIR, entry.name);
    const manifestPath = join(packageDir, "package.json");

    if (!existsSync(manifestPath)) {
        return [];
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageIdentity;

    if (manifest.private === true) {
        return [];
    }

    if (typeof manifest.name !== "string") {
        throw new TypeError(`Publishable package has no name in ${manifestPath}`);
    }

    return [{ directory: packageDir, name: manifest.name }];
}

function publishablePackages(): PublishablePackage[] {
    const entries = readdirSync(PACKAGES_DIR, { withFileTypes: true });

    return entries.flatMap((entry) => publishablePackage(entry));
}

function cleanPublishableBuildArtifacts(packages: PublishablePackage[]): void {
    for (const packageEntry of packages) {
        rmSync(join(packageEntry.directory, "dist"), { recursive: true, force: true });
        rmSync(join(packageEntry.directory, "tsconfig.lib.tsbuildinfo"), { force: true });
    }
}

async function bootstrapProjectGraph(env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("tsc", ["-b", "--force", "packages/vitest/tsconfig.lib.json"], { cwd: ROOT_DIR, env });
}

async function buildPackages(packages: PublishablePackage[], env: NodeJS.ProcessEnv): Promise<void> {
    const projects = packages.map((packageEntry) => packageEntry.name).join(",");
    await runAsync("nx", ["run-many", "-t", "build", `--projects=${projects}`, "--skip-nx-cache"], { env });
}

async function publishPackages(env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("nx", ["run-many", "-t", "release", "--skip-nx-cache"], { env });
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
        server.once("error", reject);

        server.listen(PORT, () => {
            resolve();
        });
    });
}

async function publishInto(env: NodeJS.ProcessEnv): Promise<void> {
    const packages = publishablePackages();
    cleanPublishableBuildArtifacts(packages);
    await bootstrapProjectGraph(env);
    await buildPackages(packages, env);
    await stageNativeArtifacts();
    const restorePublishedTree = prepareHostOnlyPublish();

    try {
        await publishPackages(env);
    } finally {
        restorePublishedTree();
    }
}

async function startRegistry(options: StartRegistryOptions = {}): Promise<RegistryHandle> {
    const registryDir = options.registryDir ?? mkdtempSync(join(tmpdir(), "gtkx-registry-"));
    mkdirSync(registryDir, { recursive: true });
    const configPath = join(registryDir, "config.yaml");
    const npmrcPath = join(registryDir, "npmrc");
    writeFileSync(configPath, verdaccioConfig(registryDir));
    rmSync(join(registryDir, "htpasswd"), { force: true });

    if (options.resetsStorage ?? true) {
        rmSync(join(registryDir, "storage"), { recursive: true, force: true });
    }

    const server = (await runServer(configPath)) as Server;

    try {
        await listenServer(server);
        await waitForRegistry();
        const token = await createUserToken();
        writeFileSync(npmrcPath, `registry=${REGISTRY}\n//${HOST}/:_authToken=${token}\n`);
        const env = registryEnv(npmrcPath);
        await publishInto(env);

        return { env, registry: REGISTRY, registryDir, npmrcPath, stop: () => closeServer(server) };
    } catch (error) {
        await closeServer(server);
        throw error;
    }
}

async function withRegistry(fn: (ctx: RegistryContext) => Promise<void>): Promise<void> {
    const handle = await startRegistry();

    try {
        await fn(handle);
    } finally {
        await handle.stop();
        rmSync(handle.registryDir, { recursive: true, force: true });
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
    withRegistry,
    verifyAppStarts,
    verifyBuiltAppStarts,
    type RegistryContext,
};
