import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import ts from "typescript";
import { arrayGuard, hasFields, isString } from "../guards.js";
import { PROPS_COMPILER_OPTIONS, PROPS_ORIGIN } from "./props-modules.js";

type PropsResolution = {
    specifier: string;
    containingFile: string;
    fileName: string | null;
};

type PropsDependencies = {
    files: string[];
    resolutions: PropsResolution[];
    value: string;
};

const isResolvedFile = (value: unknown): value is string | null => value === null || isString(value);

const isPropsResolution = (value: unknown): value is PropsResolution =>
    hasFields<PropsResolution>(value, {
        specifier: isString,
        containingFile: isString,
        fileName: isResolvedFile,
    });

const isPropsDependencies = (value: unknown): value is PropsDependencies =>
    hasFields<PropsDependencies>(value, {
        files: arrayGuard(isString),
        resolutions: arrayGuard(isPropsResolution),
        value: isString,
    });

const dependencyHash = (files: string[]): string => {
    const hash = createHash("sha256");

    for (const file of files) {
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }

    return hash.digest("hex");
};

const propsDependencies = (files: string[], resolutions: PropsResolution[]): PropsDependencies => ({
    files,
    resolutions,
    value: dependencyHash(files),
});

const hasFreshPropsDependencies = (dependencies: PropsDependencies): boolean => {
    try {
        if (dependencyHash(dependencies.files) !== dependencies.value) {
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
    isPropsDependencies,
    propsDependencies,
    type PropsDependencies,
    type PropsResolution,
};
