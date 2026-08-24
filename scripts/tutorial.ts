import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    REGISTRY,
    ROOT_DIR,
    runAsync,
    verifyAppStarts,
    verifyBuiltAppStarts,
    withRegistry,
} from "./e2e-registry.js";

const TUTORIAL_DIR = join(ROOT_DIR, "examples", "tutorial");
const TUTORIAL_LOCK = join(TUTORIAL_DIR, "package-lock.json");
const LOCK_NORMALIZER = fileURLToPath(new URL("normalize-package-lock-registry.ts", import.meta.url));
const PUBLIC_NPM_REGISTRY = "https://registry.npmjs.org/";
const BINARY_NAME = "gtkx-tutorial";
const DEPLOY_TARGETS = "deb,rpm";

const toError = (error: unknown): Error =>
    error instanceof Error ? error : new Error("A tutorial setup operation failed", { cause: error });

const installTutorialDependencies = async (env: NodeJS.ProcessEnv): Promise<Error | undefined> => {
    try {
        await runAsync("npm", ["install"], { cwd: TUTORIAL_DIR, env });

        return undefined;
    } catch (error) {
        return toError(error);
    }
};

const normalizeTutorialLock = async (): Promise<Error | undefined> => {
    if (!existsSync(TUTORIAL_LOCK)) {
        return undefined;
    }

    try {
        await runAsync(
            "tsx",
            [LOCK_NORMALIZER, TUTORIAL_LOCK, REGISTRY, PUBLIC_NPM_REGISTRY],
            { cwd: ROOT_DIR, env: process.env },
        );

        return undefined;
    } catch (error) {
        return toError(error);
    }
};

const throwSetupErrors = (installError: Error | undefined, normalizationError: Error | undefined): void => {
    if (installError !== undefined && normalizationError !== undefined) {
        throw new AggregateError(
            [installError, normalizationError],
            "Tutorial installation and lock normalization failed",
        );
    }

    if (installError !== undefined) {
        throw installError;
    }

    if (normalizationError !== undefined) {
        throw normalizationError;
    }
};

async function installTutorial(env: NodeJS.ProcessEnv): Promise<void> {
    rmSync(join(TUTORIAL_DIR, "node_modules"), { recursive: true, force: true });
    rmSync(TUTORIAL_LOCK, { force: true });
    const installError = await installTutorialDependencies(env);
    const normalizationError = await normalizeTutorialLock();
    throwSetupErrors(installError, normalizationError);
}

function findArtifact(extension: string): string {
    const outDir = join(TUTORIAL_DIR, "build", "out");
    const found = readdirSync(outDir).find((name) => name.endsWith(extension));

    if (found === undefined) {
        throw new Error(`tutorial: gtkx deploy wrote no ${extension} into ${outDir}`);
    }

    return join(outDir, found);
}

async function extractDeb(env: NodeJS.ProcessEnv, prefix: string): Promise<void> {
    await runAsync("dpkg-deb", ["-x", findArtifact(".deb"), prefix], { cwd: TUTORIAL_DIR, env });
}

async function deployTutorial(env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("npm", ["run", "deploy", "--", "--target", DEPLOY_TARGETS], { cwd: TUTORIAL_DIR, env });
    const prefix = mkdtempSync(join(tmpdir(), "gtkx-tutorial-install-"));

    try {
        findArtifact(".rpm");
        await extractDeb(env, prefix);
        await verifyAppStarts(prefix, { command: join(prefix, "usr", "bin", BINARY_NAME), args: [] });
        console.log(`tutorial: the packaged ${BINARY_NAME} installs and starts`);
    } finally {
        rmSync(prefix, { recursive: true, force: true });
    }
}

async function validateTutorial(env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("npm", ["run", "build"], { cwd: TUTORIAL_DIR, env });
    await verifyBuiltAppStarts(TUTORIAL_DIR);
    await runAsync("npm", ["run", "typecheck"], { cwd: TUTORIAL_DIR, env });
    await runAsync("npm", ["run", "test"], { cwd: TUTORIAL_DIR, env });
    await deployTutorial(env);
    console.log("tutorial: install, build, run, typecheck, test, and deploy succeeded");
}

async function main(): Promise<void> {
    const passthrough = process.argv.slice(2);

    await withRegistry(async ({ env }) => {
        await installTutorial(env);

        if (passthrough.length > 0) {
            await runAsync("npm", passthrough, { cwd: TUTORIAL_DIR, env });
        } else {
            await validateTutorial(env);
        }
    });
}

await main();
