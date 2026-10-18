import { createHash } from "node:crypto";
import { dirname } from "node:path";
import ts from "typescript";
import { z } from "zod";
import { PROPS_COMPILER_OPTIONS, PROPS_ORIGIN } from "./props-modules.js";

const propsResolutionSchema = z.object({
    specifier: z.string(),
    containingFile: z.string(),
    fileName: z.string().nullable(),
});

const propsDependenciesSchema = z.object({
    files: z.array(z.string()),
    resolutions: z.array(propsResolutionSchema),
    value: z.string(),
});

type PropsResolution = z.infer<typeof propsResolutionSchema>;
type PropsDependencies = z.infer<typeof propsDependenciesSchema>;

const dependencyHash = (sources: Iterable<[string, string]>): string => {
    const hash = createHash("sha256");

    for (const [file, source] of sources) {
        hash.update(file);
        hash.update("\0");
        hash.update(source);
    }

    return hash.digest("hex");
};

const propsDependencies = (
    sources: ReadonlyMap<string, string>,
    resolutions: PropsResolution[],
): PropsDependencies => ({
    files: sources.keys().toArray(),
    resolutions,
    value: dependencyHash(sources),
});

const readDependency = (file: string): [string, string] => {
    const source = ts.sys.readFile(file);

    if (source === undefined) {
        throw new Error(`Cannot read reference dependency ${file}`);
    }

    return [file, source];
};

const hasFreshPropsDependencies = (dependencies: PropsDependencies): boolean => {
    try {
        if (dependencyHash(dependencies.files.map((file) => readDependency(file))) !== dependencies.value) {
            return false;
        }

        const cache = ts.createModuleResolutionCache(
            dirname(PROPS_ORIGIN),
            (fileName) => fileName,
            PROPS_COMPILER_OPTIONS,
        );

        return dependencies.resolutions.every(({ specifier, containingFile, fileName }) => {
            const resolved = ts.resolveModuleName(
                specifier,
                containingFile,
                PROPS_COMPILER_OPTIONS,
                ts.sys,
                cache,
            ).resolvedModule;

            return (resolved?.resolvedFileName ?? null) === fileName;
        });
    } catch {
        return false;
    }
};

export {
    hasFreshPropsDependencies,
    propsDependenciesSchema,
    propsDependencies,
    type PropsDependencies,
    type PropsResolution,
};
