import { spawn } from "node:child_process";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { runServer } from "verdaccio";

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
const NATIVE_DIR = join(ROOT_DIR, "packages", "native");

type HostNativeTarget = { triple: string; platformPackage: string };

const hostNativeTargets: { [arch: string]: HostNativeTarget } = {
    x64: { triple: "x86_64-unknown-linux-gnu", platformPackage: "@gtkx/native-linux-x64-gnu" },
    arm64: { triple: "aarch64-unknown-linux-gnu", platformPackage: "@gtkx/native-linux-arm64-gnu" },
};

type NativeManifest = {
    version: string;
    napi: { binaryName: string; targets: string[] };
    optionalDependencies: { [name: string]: string };
};

const trackedFilesRewrittenByPublish = (): string[] => {
    const paths = [join(ROOT_DIR, "pnpm-lock.yaml"), join(NATIVE_DIR, "package.json")];
    const npmDir = join(NATIVE_DIR, "npm");
    if (existsSync(npmDir)) {
        for (const entry of readdirSync(npmDir)) {
            const manifest = join(npmDir, entry, "package.json");
            if (existsSync(manifest)) paths.push(manifest);
        }
    }
    return paths;
};

const prepareHostOnlyPublish = (): (() => void) => {
    const host = hostNativeTargets[process.arch];
    if (host === undefined) {
        throw new Error(`release-e2e cannot stage native artifacts for architecture "${process.arch}"`);
    }
    const snapshot = new Map<string, string>();
    for (const path of trackedFilesRewrittenByPublish()) {
        snapshot.set(path, readFileSync(path, "utf8"));
    }
    const manifestPath = join(NATIVE_DIR, "package.json");
    const manifest: NativeManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.napi.targets = [host.triple];
    manifest.optionalDependencies = { [host.platformPackage]: manifest.version };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
    return () => {
        for (const [path, content] of snapshot) writeFileSync(path, content);
    };
};

const PORT = 4873;
const HOST = `localhost:${PORT}`;
const REGISTRY = `http://${HOST}/`;
const APP_NAME = "release-e2e";
const APPLICATION_ID = "com.gtkx.release-e2e";

type UserResponse = {
    token?: string;
};

type RunOptions = {
    cwd?: string | undefined;
    env?: NodeJS.ProcessEnv;
};

export function runAsync(command: string, args: string[], options: RunOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: "inherit" });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code ?? "unknown"}: ${command} ${args.join(" ")}`));
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
    const response = await fetch(`${REGISTRY}-/user/org.couchdb.user:${APP_NAME}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: APP_NAME, password: APP_NAME, email: "e2e@gtkx.dev" }),
    });
    if (!response.ok) {
        throw new Error(`Failed to register Verdaccio user: HTTP ${response.status}`);
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

async function stageNativeArtifacts(): Promise<void> {
    await runAsync("turbo", ["run", "build", "--filter", "@gtkx/native"], { env: process.env });
    const artifactsDir = join(NATIVE_DIR, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    for (const entry of readdirSync(NATIVE_DIR)) {
        if (entry.startsWith("native.") && entry.endsWith(".node")) {
            copyFileSync(join(NATIVE_DIR, entry), join(artifactsDir, entry));
        }
    }
}

async function publishPackages(env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync(
        "turbo",
        [
            "run",
            "release",
            "--filter",
            "!gtkx",
            "--filter",
            "!./examples/*",
            "--filter",
            "!./website",
            "--filter",
            "!@gtkx/e2e",
        ],
        { env },
    );
}

async function scaffoldConsumer(consumerRoot: string, env: NodeJS.ProcessEnv): Promise<string> {
    await runAsync(
        "npm",
        ["create", "gtkx", APP_NAME, "--", "--application-id", APPLICATION_ID, "--pm", "npm", "--vitest"],
        {
            cwd: consumerRoot,
            env,
        },
    );
    return join(consumerRoot, APP_NAME);
}

async function buildConsumer(appDir: string, env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("npm", ["run", "build"], { cwd: appDir, env });
}

async function typecheckConsumer(appDir: string, env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("npm", ["run", "typecheck"], { cwd: appDir, env });
}

async function testConsumer(appDir: string, env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("npm", ["test"], { cwd: appDir, env });
}

async function main(): Promise<void> {
    const registryDir = mkdtempSync(join(tmpdir(), "gtkx-registry-"));
    const consumerRoot = mkdtempSync(join(tmpdir(), "gtkx-consumer-"));
    const configPath = join(registryDir, "config.yaml");
    const npmrcPath = join(registryDir, "npmrc");

    let server: Server | undefined;
    let restorePublishedTree: (() => void) | undefined;

    try {
        writeFileSync(configPath, verdaccioConfig(registryDir));
        const activeServer: Server = await runServer(configPath);
        server = activeServer;

        await new Promise<void>((resolve, reject) => {
            activeServer.once("error", reject);
            activeServer.listen(PORT, () => resolve());
        });

        await waitForRegistry();

        const token = await createUserToken();
        writeFileSync(npmrcPath, `registry=${REGISTRY}\n//${HOST}/:_authToken=${token}\n`);

        const env = registryEnv(npmrcPath);
        restorePublishedTree = prepareHostOnlyPublish();
        await stageNativeArtifacts();
        await publishPackages(env);

        const appDir = await scaffoldConsumer(consumerRoot, env);
        await buildConsumer(appDir, env);
        await typecheckConsumer(appDir, env);
        await testConsumer(appDir, env);

        console.log("release-e2e: consumer scaffold, build, typecheck, and test succeeded");
    } finally {
        restorePublishedTree?.();

        if (server) {
            const runningServer = server;
            await new Promise<void>((resolve) => {
                runningServer.close(() => resolve());
            });
        }

        rmSync(registryDir, { recursive: true, force: true });
        rmSync(consumerRoot, { recursive: true, force: true });
    }
}

await main();
