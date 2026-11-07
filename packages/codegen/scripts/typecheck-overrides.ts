import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

const packageDir = join(import.meta.dirname, "..");
const workspaceRoot = join(packageDir, "..", "..");
const overridesDir = join(packageDir, "overrides");
const storeDir = realpathSync(join(workspaceRoot, "node_modules", "@gtkx", "gi"));
const outputDir = join(workspaceRoot, "build", "overrides-typecheck");
const mirrorDir = join(outputDir, "gi");

// The store's modules import the declarations emitted from these overrides, and an emitted augmentation checked
// beside its source merges with it into overloads, which TypeScript relates with their generics erased, hiding
// errors. The mirror links the store's package.json and every declaration except those, so rootDirs resolves each
// override module to its source, and @gtkx/gi resolves to the mirror so the store loads once.
const isMirrored = (file: string): boolean =>
    file === "package.json" ||
    (file.endsWith(".d.ts") &&
        (basename(file) === "index.d.ts" || !existsSync(join(overridesDir, `${file.slice(0, -".d.ts".length)}.ts`))));

rmSync(outputDir, { recursive: true, force: true });

for (const entry of readdirSync(storeDir, { recursive: true, withFileTypes: true })) {
    const file = relative(storeDir, join(entry.parentPath, entry.name));

    if (entry.isFile() && isMirrored(file)) {
        mkdirSync(dirname(join(mirrorDir, file)), { recursive: true });
        symlinkSync(join(storeDir, file), join(mirrorDir, file));
    }
}

type BaseConfig = { compilerOptions: { paths: Record<string, string[]> } };

const base = JSON.parse(readFileSync(join(workspaceRoot, "tsconfig.base.json"), "utf8")) as BaseConfig;
const paths = Object.fromEntries(
    Object.entries(base.compilerOptions.paths).map(([specifier, targets]) => [
        specifier,
        targets.map((target) => relative(outputDir, join(workspaceRoot, target))),
    ]),
);

const tsconfig = {
    extends: relative(outputDir, join(overridesDir, "tsconfig.json")),
    compilerOptions: {
        rootDirs: [relative(outputDir, overridesDir), "./gi"],
        paths: { ...paths, "@gtkx/gi/*": ["./gi/*/index.d.ts"] },
    },
};

writeFileSync(join(outputDir, "tsconfig.json"), `${JSON.stringify(tsconfig, null, 4)}\n`);
