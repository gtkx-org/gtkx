import { join } from "node:path";
import process from "node:process";
import { REGISTRY, ROOT_DIR, startRegistry } from "../scripts/e2e-registry.js";

const REGISTRY_DIR = join(ROOT_DIR, ".bughunt-registry");

const waitForShutdown = (): Promise<void> =>
    new Promise<void>((resolve) => {
        process.once("SIGINT", () => {
            resolve();
        });

        process.once("SIGTERM", () => {
            resolve();
        });
    });

const main = async (): Promise<void> => {
    const handle = await startRegistry({ registryDir: REGISTRY_DIR, resetsStorage: true });
    console.log(`bughunt-registry: workspace published at ${REGISTRY}`);
    console.log(`bughunt-registry: npmrc ${handle.npmrcPath}`);
    console.log("bughunt-registry: ready");
    await waitForShutdown();
    await handle.stop();
    console.log("bughunt-registry: stopped");
};

await main();
