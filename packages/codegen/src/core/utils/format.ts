import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Biome, Distribution } from "@biomejs/js-api";

/** Shared Biome instance and project key for formatting. Lazily initialized. */
let biomeInstance: Biome | null = null;
let projectKey: number | null = null;

/**
 * Finds and loads biome.json from the repository root.
 */
function loadBiomeConfig(): string {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const repoRoot = join(currentDir, "..", "..", "..", "..", "..");
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
        const configContent = loadBiomeConfig();
        biomeInstance.applyConfiguration(projectKey, JSON.parse(configContent));
    }
    return { biome: biomeInstance, projectKey };
}
