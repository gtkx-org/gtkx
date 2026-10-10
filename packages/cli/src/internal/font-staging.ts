import { sortStrings } from "@gtkx/utils";
import { lstatSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parseFontSpecifier } from "../vite-plugins/asset-specifier.js";
import { fontFileName, FONTS_DIR } from "./font-path.js";
import { discoverSourceFiles, importsIn, type SourceImport, sourceLanguage } from "./source-imports.js";
import type { RetainedStagingDir } from "./staging-dir.js";

type FontStagingStatus = "absent" | "staged" | "unmanaged";

const FONT_QUERY = "?font";

const isRelativeImport = (source: string): boolean => source.startsWith("./") || source.startsWith("../");

const existingPath = (path: string): string | null =>
    lstatSync(path, { throwIfNoEntry: false }) === undefined ? null : path;

const resolveRelativeImport = (importer: string, assetSource: string): string | null =>
    existingPath(resolve(dirname(importer), assetSource));

const resolveAbsoluteImport = (root: string, assetSource: string): string | null =>
    existingPath(assetSource) ?? existingPath(join(root, assetSource));

const resolvePackageImport = (importer: string, assetSource: string): string | null => {
    try {
        return createRequire(importer).resolve(assetSource);
    } catch {
        return null;
    }
};

const resolveFontImport = (root: string, importer: string, assetSource: string): string | null => {
    if (isRelativeImport(assetSource)) {
        return resolveRelativeImport(importer, assetSource);
    }

    if (isAbsolute(assetSource)) {
        return resolveAbsoluteImport(root, assetSource);
    }

    return resolvePackageImport(importer, assetSource);
};

const fontFileFor = (root: string, { importer, source }: SourceImport): string | null => {
    const specifier = parseFontSpecifier(source);

    return specifier === null ? null : resolveFontImport(root, importer, specifier.assetSource);
};

const hasFontImportMention = (filePath: string): boolean => {
    if (sourceLanguage(filePath) === undefined) {
        return false;
    }

    try {
        return readFileSync(filePath, "utf8").includes(FONT_QUERY);
    } catch {
        return false;
    }
};

const projectFontFiles = (root: string): string[] => {
    const files = discoverSourceFiles(root)
        .filter((path) => hasFontImportMention(path))
        .flatMap((path) => importsIn(path))
        .map((entry) => fontFileFor(root, entry))
        .filter((path): path is string => path !== null);

    return sortStrings(new Set(files));
};

const stagedPath = (fontsDir: string, sourcePath: string, content: Buffer): string =>
    join(fontsDir, fontFileName(sourcePath, content));

const stageFont = (fontsDir: string, sourcePath: string): void => {
    const target = stagedPath(fontsDir, sourcePath, readFileSync(sourcePath));

    if (existingPath(target) !== null) {
        return;
    }

    symlinkSync(sourcePath, target, "file");
};

const stagedFontsDir = (staging: RetainedStagingDir): string | null => {
    const shareDir = staging.getPath();

    return shareDir === null ? null : join(shareDir, FONTS_DIR);
};

const stagedFontStatus = (staging: RetainedStagingDir, sourcePath: string, content: Buffer): FontStagingStatus => {
    const fontsDir = stagedFontsDir(staging);

    if (fontsDir === null) {
        return "unmanaged";
    }

    return existingPath(stagedPath(fontsDir, sourcePath, content)) === null ? "absent" : "staged";
};

const isUnstagedFont = (fontsDir: string, sourcePath: string): boolean =>
    existingPath(stagedPath(fontsDir, sourcePath, readFileSync(sourcePath))) === null;

const hasUnstagedFontImport = (staging: RetainedStagingDir, root: string, filePath: string): boolean => {
    const fontsDir = stagedFontsDir(staging);

    if (fontsDir === null || !hasFontImportMention(filePath)) {
        return false;
    }

    return projectFontFiles(root).some((sourcePath) => isUnstagedFont(fontsDir, sourcePath));
};

const stageProjectFonts = (root: string, staging: RetainedStagingDir): string => {
    const shareDir = staging.retain();
    const fontsDir = join(shareDir, FONTS_DIR);
    mkdirSync(fontsDir, { recursive: true });

    for (const sourcePath of projectFontFiles(root)) {
        stageFont(fontsDir, sourcePath);
    }

    return shareDir;
};

export { hasUnstagedFontImport, stagedFontStatus, stageProjectFonts };
