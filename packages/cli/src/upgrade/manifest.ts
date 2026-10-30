import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const DependencyMapSchema = z.record(z.string(), z.string());

const ManifestSchema = z.looseObject({
    version: z.string().optional(),
    workspaces: z.union([z.array(z.string()), z.looseObject({ packages: z.array(z.string()) })]).optional(),
    dependencies: DependencyMapSchema.optional(),
    devDependencies: DependencyMapSchema.optional(),
    optionalDependencies: DependencyMapSchema.optional(),
    peerDependencies: DependencyMapSchema.optional(),
});

type Manifest = z.infer<typeof ManifestSchema>;
type DependencyField = "dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies";

const MANIFEST_FILE = "package.json";

const manifestPath = (directory: string): string => join(directory, MANIFEST_FILE);

const parseManifest = (value: unknown): Manifest => ManifestSchema.parse(value);

const readManifest = (directory: string): Manifest =>
    parseManifest(JSON.parse(readFileSync(manifestPath(directory), "utf8")));

/**
 * Whether a package belongs to the GTKX release train, which publishes every package at one version.
 */
const isGtkxPackage = (name: string): boolean => name.startsWith("@gtkx/") || name === "create-gtkx";

export { type DependencyField, isGtkxPackage, MANIFEST_FILE, manifestPath, parseManifest, readManifest };
