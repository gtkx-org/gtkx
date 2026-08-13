import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT_DIR, runAsync, verifyAppStarts, verifyBuiltAppStarts, withRegistry } from "./e2e-registry.js";

const TUTORIAL_DIR = join(ROOT_DIR, "examples", "tutorial");
const BINARY_NAME = "gtkx-tutorial";
const DEPLOY_TARGETS = "deb,rpm";

async function installTutorial(env: NodeJS.ProcessEnv): Promise<void> {
    rmSync(join(TUTORIAL_DIR, "node_modules"), { recursive: true, force: true });
    rmSync(join(TUTORIAL_DIR, "package-lock.json"), { force: true });
    await runAsync("npm", ["install"], { cwd: TUTORIAL_DIR, env });
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
