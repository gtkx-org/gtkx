import { rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT_DIR, runAsync, verifyBuiltAppStarts, withRegistry } from "./e2e-registry.js";

const TUTORIAL_DIR = join(ROOT_DIR, "examples", "tutorial");

async function installTutorial(env: NodeJS.ProcessEnv): Promise<void> {
    rmSync(join(TUTORIAL_DIR, "node_modules"), { recursive: true, force: true });
    rmSync(join(TUTORIAL_DIR, "package-lock.json"), { force: true });
    await runAsync("npm", ["install"], { cwd: TUTORIAL_DIR, env });
}

async function validateTutorial(env: NodeJS.ProcessEnv): Promise<void> {
    await runAsync("npm", ["run", "build"], { cwd: TUTORIAL_DIR, env });
    await verifyBuiltAppStarts(TUTORIAL_DIR);
    await runAsync("npm", ["run", "typecheck"], { cwd: TUTORIAL_DIR, env });
    await runAsync("npm", ["run", "test"], { cwd: TUTORIAL_DIR, env });
    console.log("tutorial: install, build, run, typecheck, and test succeeded");
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
