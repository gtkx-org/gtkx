import { sortStrings } from "@gtkx/utils";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseFontSpecifier } from "../vite-plugins/asset-specifier.js";
import { fontFileName, FONTS_DIR } from "./font-path.js";
import { discoverSourceImports, sourceDirFor, type SourceImport } from "./source-imports.js";
import { removeTempDir } from "./staging-dir.js";

const FONT_STAGING_PREFIX = "gtkx-fonts-";

const isRelativeImport = (source: string): boolean => source.startsWith("./") || source.startsWith("../");

const fontFileFor = ({ importer, source }: SourceImport): string | null => {
    const specifier = parseFontSpecifier(source);

    return specifier === null || !isRelativeImport(source)
        ? null
        : resolve(dirname(importer), specifier.assetSource);
};

const findImportedFontFiles = (imports: SourceImport[]): string[] => {
    const files = imports
        .map((entry) => fontFileFor(entry))
        .filter((path): path is string => path !== null);

    return sortStrings(new Set(files));
};

const stageFont = (fontsDir: string, sourcePath: string): void => {
    const fileName = fontFileName(sourcePath, readFileSync(sourcePath));

    symlinkSync(sourcePath, join(fontsDir, fileName), "file");
};

const stageProjectFonts = (root: string): string | null => {
    const fontFiles = findImportedFontFiles(discoverSourceImports(sourceDirFor(root)));

    if (fontFiles.length === 0) {
        return null;
    }

    const shareDir = mkdtempSync(join(tmpdir(), FONT_STAGING_PREFIX));
    mkdirSync(join(shareDir, FONTS_DIR));

    for (const sourcePath of fontFiles) {
        stageFont(join(shareDir, FONTS_DIR), sourcePath);
    }

    process.once("exit", () => {
        removeTempDir(shareDir);
    });

    return shareDir;
};

export { stageProjectFonts };
