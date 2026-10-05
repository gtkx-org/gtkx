import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";
import { type RegistryContext, startRegistry } from "./registry.js";

declare module "vitest" {
    interface ProvidedContext {
        registry: RegistryContext;
    }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
    const registryDir = mkdtempSync(join(tmpdir(), "gtkx-registry-"));
    const cleanup = (): void => {
        rmSync(registryDir, { recursive: true, force: true });
    };

    try {
        const handle = await startRegistry({ registryDir, visibilityDelayMs: 3000 });
        project.provide("registry", {
            env: handle.env,
            registry: handle.registry,
            registryDir: handle.registryDir,
        });

        return async () => {
            try {
                await handle.stop();
            } finally {
                cleanup();
            }
        };
    } catch (error) {
        cleanup();
        throw error;
    }
}
