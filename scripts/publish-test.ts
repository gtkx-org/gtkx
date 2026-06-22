#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { runServer } from "verdaccio";

const PORT = 4873;
const HOST = `localhost:${PORT}`;
const REGISTRY = `http://${HOST}/`;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const nativeDir = join(repoRoot, "packages", "native");

const APP_NAME = "smoke-app";
const APPLICATION_ID = "com.gtkx.smoke";
const BUILD_OUTPUTS = ["dist/bundle.js", "dist/gtkx.node"];
const PUBLISH_MUTATED_MANIFESTS = [
    join(nativeDir, "package.json"),
    join(nativeDir, "npm", "linux-x64-gnu", "package.json"),
    join(nativeDir, "npm", "linux-arm64-gnu", "package.json"),
];

interface RunOptions {
    cwd: string;
    env?: NodeJS.ProcessEnv;
}

interface UserResponse {
    token?: string;
}

function verdaccioConfig(workDir: string): string {
    return `storage: ${join(workDir, "storage")}
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

function run(command: string, args: string[], options: RunOptions): Promise<void> {
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
    const username = "smoke";
    const response = await fetch(`${REGISTRY}-/user/org.couchdb.user:${username}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: username, password: "smoke", email: "smoke@gtkx.dev" }),
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
    delete env["NPM_CONFIG_PROVENANCE"];
    return env;
}

async function stageNativeArtifacts(): Promise<void> {
    await run("pnpm", ["--filter", "@gtkx/native", "native-build"], { cwd: repoRoot });
    const artifactsDir = join(nativeDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    const binaries = readdirSync(nativeDir).filter((name) => name.startsWith("native.") && name.endsWith(".node"));
    if (binaries.length === 0) {
        throw new Error("native-build produced no .node binary to stage");
    }
    for (const binary of binaries) {
        copyFileSync(join(nativeDir, binary), join(artifactsDir, binary));
    }
}

async function publishPackages(env: NodeJS.ProcessEnv): Promise<void> {
    await run("pnpm", ["release"], { cwd: repoRoot, env });
}

async function scaffoldConsumer(consumerRoot: string, env: NodeJS.ProcessEnv): Promise<string> {
    const cliPrefix = join(consumerRoot, "cli-prefix");
    await run("npm", ["install", "--global", "--prefix", cliPrefix, "@gtkx/cli"], { cwd: consumerRoot, env });
    await run(
        join(cliPrefix, "bin", "gtkx"),
        ["create", APP_NAME, "--application-id", APPLICATION_ID, "--pm", "npm", "--testing", "vitest"],
        { cwd: consumerRoot, env },
    );
    return join(consumerRoot, APP_NAME);
}

async function buildConsumer(appDir: string, env: NodeJS.ProcessEnv): Promise<void> {
    await run("npm", ["run", "build"], { cwd: appDir, env });
}

async function typecheckConsumer(appDir: string, env: NodeJS.ProcessEnv): Promise<void> {
    await run("npm", ["run", "typecheck"], { cwd: appDir, env });
}

async function testConsumer(appDir: string, env: NodeJS.ProcessEnv): Promise<void> {
    await run("npm", ["test"], { cwd: appDir, env });
}

function assertBuildOutputs(appDir: string): void {
    for (const relativePath of BUILD_OUTPUTS) {
        const outputPath = join(appDir, relativePath);
        if (!existsSync(outputPath)) {
            throw new Error(`Expected build output is missing: ${relativePath}`);
        }
        if (statSync(outputPath).size === 0) {
            throw new Error(`Build output is empty: ${relativePath}`);
        }
    }
}

function snapshotManifests(): Map<string, string> {
    const snapshot = new Map<string, string>();
    for (const manifest of PUBLISH_MUTATED_MANIFESTS) {
        snapshot.set(manifest, readFileSync(manifest, "utf8"));
    }
    return snapshot;
}

function restoreManifests(snapshot: Map<string, string>): void {
    for (const [manifest, contents] of snapshot) {
        writeFileSync(manifest, contents);
    }
}

async function main(): Promise<void> {
    const registryDir = mkdtempSync(join(tmpdir(), "gtkx-registry-"));
    const consumerRoot = mkdtempSync(join(tmpdir(), "gtkx-consumer-"));
    const configPath = join(registryDir, "config.yaml");
    const npmrcPath = join(registryDir, "npmrc");
    const manifestSnapshot = snapshotManifests();

    let server: Server | undefined;
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

        await stageNativeArtifacts();
        await publishPackages(env);
        const appDir = await scaffoldConsumer(consumerRoot, env);
        await buildConsumer(appDir, env);
        assertBuildOutputs(appDir);
        await typecheckConsumer(appDir, env);
        await testConsumer(appDir, env);

        console.log("publish-test: consumer scaffold, build, typecheck, and test succeeded");
    } finally {
        if (server) {
            const runningServer = server;
            await new Promise<void>((resolve) => {
                runningServer.close(() => resolve());
            });
        }
        restoreManifests(manifestSnapshot);
        rmSync(registryDir, { recursive: true, force: true });
        rmSync(consumerRoot, { recursive: true, force: true });
    }
}

await main();
