import { join } from "node:path";
import process from "node:process";
import { REGISTRY, ROOT_DIR, startRegistry } from "./e2e-registry.js";

const REGISTRY_DIR = join(ROOT_DIR, ".local-registry");

function waitForShutdown(): Promise<void> {
    return new Promise<void>((resolve) => {
        process.once("SIGINT", () => {
            resolve();
        });

        process.once("SIGTERM", () => {
            resolve();
        });
    });
}

function announce(npmrcPath: string): void {
    console.log(`
local-registry: serving the workspace packages at ${REGISTRY}

  Point a project at it:
    npm config set registry ${REGISTRY} --location project
    pnpm install

  Or per command:
    NPM_CONFIG_REGISTRY=${REGISTRY} pnpm install

  Auth token (publishing only): ${npmrcPath}
  Storage: ${join(REGISTRY_DIR, "storage")}

Press Ctrl-C to stop.
`);
}

async function main(): Promise<void> {
    const handle = await startRegistry({ registryDir: REGISTRY_DIR });
    announce(handle.npmrcPath);
    await waitForShutdown();
    await handle.stop();
    console.log("local-registry: stopped");
}

await main();
