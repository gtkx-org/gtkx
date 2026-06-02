#!/usr/bin/env node
/**
 * Consumer bootstrap smoke test invoked by `pnpm publish-test` (locally through
 * `scripts/docker-run` and from the `consumer-smoke` CI job). It exercises the
 * full publish → install → scaffold → build path that a real downstream user
 * follows, against a build-isolated Verdaccio registry:
 *
 * 1. Starts a Verdaccio registry that serves `@gtkx/*` from local storage only
 *    (no uplink) while proxying every other package to npmjs, so the scaffolded
 *    app resolves the freshly built packages instead of anything on npm.
 * 2. Registers a registry user and writes a throwaway `.npmrc` (pointed to by
 *    `NPM_CONFIG_USERCONFIG`) so pnpm, the release script's `npm publish`
 *    calls, and the consumer's installs all target the local registry with
 *    that token, without touching any global config.
 * 3. Builds the native binary for the current architecture and stages it the
 *    way the release workflow arranges downloaded artifacts, then reuses the
 *    release script (pointed at Verdaccio, without provenance) to build and
 *    publish every public `@gtkx/*` package.
 * 4. Installs the published CLI globally, scaffolds a new app with `gtkx create`
 *    in a directory outside the workspace, and builds it with `gtkx build`.
 * 5. Asserts the build produced a non-empty bundle and native binary, then
 *    type-checks the app and runs its own test suite, which renders it under
 *    Xvfb.
 *
 * The process exits non-zero if any step fails, and always tears down the
 * registry and temporary directories.
 */

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

/**
 * Builds the Verdaccio configuration YAML for a throwaway registry rooted at
 * `workDir`. The `@gtkx/*` scope has no uplink, so only locally published
 * versions are served; every other package proxies to npmjs.
 *
 * @param workDir - Absolute path of the temporary registry working directory.
 * @returns The configuration file contents.
 */
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

/**
 * Runs a command with inherited stdio, rejecting if it exits non-zero so the
 * caller's teardown still runs. It spawns asynchronously so the in-process
 * Verdaccio registry keeps answering requests while the command runs; a
 * synchronous spawn would block the event loop and freeze the registry.
 *
 * @param command - The executable to invoke.
 * @param args - The arguments to pass.
 * @param options - The working directory and optional environment.
 */
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

/**
 * Probes the registry's ping endpoint.
 *
 * @returns `true` once the registry answers successfully.
 */
async function ping(): Promise<boolean> {
    try {
        const response = await fetch(`${REGISTRY}-/ping`);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Polls the registry until it is ready to serve requests.
 */
async function waitForRegistry(): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (await ping()) {
            return;
        }
        await delay(500);
    }
    throw new Error("Verdaccio did not become ready in time");
}

/**
 * Registers a user with the running registry and returns its publish token.
 *
 * @returns The bearer token to write into the npm config.
 */
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
    const body: UserResponse = await response.json();
    if (!body.token) {
        throw new Error("Verdaccio did not return an authentication token");
    }
    return body.token;
}

/**
 * Builds the environment for the publish and consumer commands. Both `npm` and
 * `pnpm` read the registry and token from the throwaway `.npmrc` pointed to by
 * `NPM_CONFIG_USERCONFIG`, which propagates through `pnpm run` into the nested
 * `pnpm -r publish` and `napi`/`npm publish` calls, so no global config is
 * touched. Provenance is dropped for the throwaway publish.
 *
 * @param userConfig - Absolute path of the throwaway npm config.
 * @returns The environment for every publish and consumer command.
 */
function registryEnv(userConfig: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        npm_config_registry: REGISTRY,
        NPM_CONFIG_USERCONFIG: userConfig,
    };
    delete env.NPM_CONFIG_PROVENANCE;
    return env;
}

/**
 * Builds the native binary for the current architecture and stages it under
 * `packages/native/artifacts/`, mirroring how the release workflow's
 * downloaded per-architecture artifacts are arranged so the release pipeline's
 * `napi artifacts` step distributes it into the platform package.
 */
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

/**
 * Builds and publishes every public package to the local registry by reusing
 * the release script. `pnpm -r publish` and the native package's `napi
 * prepublish` step both read the registry and token from the user `.npmrc`, so
 * they target the local registry without provenance.
 *
 * @param env - The registry-scoped environment.
 */
async function publishPackages(env: NodeJS.ProcessEnv): Promise<void> {
    await run("pnpm", ["release"], { cwd: repoRoot, env });
}

/**
 * Installs the published CLI into a writable global prefix (the system prefix
 * is not writable when the container runs as a non-root user) and scaffolds a
 * new app outside the workspace so its codegen resolves a standalone store
 * rather than the monorepo's.
 *
 * @param consumerRoot - The temporary directory that will hold the new app.
 * @param env - The registry-scoped environment.
 * @returns The absolute path of the scaffolded app.
 */
async function scaffoldConsumer(consumerRoot: string, env: NodeJS.ProcessEnv): Promise<string> {
    const cliPrefix = join(consumerRoot, "cli-prefix");
    await run("npm", ["install", "--global", "--prefix", cliPrefix, "@gtkx/cli"], { cwd: consumerRoot, env });
    await run(
        join(cliPrefix, "bin", "gtkx"),
        [
            "create",
            APP_NAME,
            "--application-id",
            APPLICATION_ID,
            "--pm",
            "npm",
            "--testing",
            "vitest",
            "--no-claude-skills",
        ],
        { cwd: consumerRoot, env },
    );
    return join(consumerRoot, APP_NAME);
}

/**
 * Builds the scaffolded app through its own `build` script, which runs the
 * app-local `gtkx build`.
 *
 * @param appDir - The scaffolded app directory.
 * @param env - The registry-scoped environment.
 */
async function buildConsumer(appDir: string, env: NodeJS.ProcessEnv): Promise<void> {
    await run("npm", ["run", "build"], { cwd: appDir, env });
}

/**
 * Type-checks the scaffolded app, confirming the published bindings resolve
 * every namespace `@gtkx/react`'s types reference (including WebKit, which the
 * WebView node's typings import) — something the bundler's type stripping would
 * otherwise hide.
 *
 * @param appDir - The scaffolded app directory.
 * @param env - The registry-scoped environment.
 */
async function typecheckConsumer(appDir: string, env: NodeJS.ProcessEnv): Promise<void> {
    await run("npm", ["run", "typecheck"], { cwd: appDir, env });
}

/**
 * Runs the scaffolded app's own test suite, which renders the app under Xvfb
 * via `@gtkx/vitest` and queries it through `@gtkx/testing`, exercising the
 * published runtime — not just the bundle — end to end.
 *
 * @param appDir - The scaffolded app directory.
 * @param env - The registry-scoped environment.
 */
async function testConsumer(appDir: string, env: NodeJS.ProcessEnv): Promise<void> {
    await run("npm", ["test"], { cwd: appDir, env });
}

/**
 * Asserts that the build produced the expected non-empty outputs.
 *
 * @param appDir - The scaffolded app directory.
 */
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

/**
 * Captures the contents of the manifests that the release pipeline rewrites in
 * place — native `optionalDependencies` version pinning and the regenerated
 * platform package manifests — so the working tree can be restored afterwards.
 *
 * @returns A map of manifest path to its original contents.
 */
function snapshotManifests(): Map<string, string> {
    const snapshot = new Map<string, string>();
    for (const manifest of PUBLISH_MUTATED_MANIFESTS) {
        snapshot.set(manifest, readFileSync(manifest, "utf8"));
    }
    return snapshot;
}

/**
 * Restores manifests captured by {@link snapshotManifests} to their original
 * contents so the smoke test leaves the working tree unchanged.
 *
 * @param snapshot - The manifest contents captured before publishing.
 */
function restoreManifests(snapshot: Map<string, string>): void {
    for (const [manifest, contents] of snapshot) {
        writeFileSync(manifest, contents);
    }
}

/**
 * Orchestrates the full consumer smoke test and guarantees teardown.
 */
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
