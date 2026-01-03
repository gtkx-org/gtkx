import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Biome, Distribution } from "@biomejs/js-api";

let biomeInstance: Biome | null = null;
let projectKey: number | null = null;

function loadBiomeConfig(): string {
    const repoRoot = join(import.meta.dirname, "..", "..", "..", "..", "..");
    const configPath = join(repoRoot, "biome.json");
    return readFileSync(configPath, "utf-8");
}

/**
 * Gets or creates the shared Biome instance.
 */
export async function getBiome(): Promise<{ biome: Biome; projectKey: number }> {
    if (!biomeInstance || !projectKey) {
        biomeInstance = await Biome.create({ distribution: Distribution.NODE });
        const projectResult = biomeInstance.openProject();
        projectKey = projectResult.projectKey;
        const config = JSON.parse(loadBiomeConfig());
        config.vcs = { ...config.vcs, useIgnoreFile: false };
        biomeInstance.applyConfiguration(projectKey, config);
    }
    return { biome: biomeInstance, projectKey };
}
