import type { Config } from "@gtkx/config";
import { resolveGirPath, resolveLibraries } from "@gtkx/codegen";
import { resolveBoundLibraries } from "@gtkx/codegen/internal";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { type CodegenStore, resolveCodegenStore } from "./store-resolver.js";

type ExportTarget = string | { [condition: string]: ExportTarget };
type StoreExports = Record<string, ExportTarget>;

type CodegenInputs = {
    girPath: string[];
    libraries: string[];
    store: CodegenStore;
};

const PACKAGE_EXPORT = "./package.json";
const JSX_REQUIRED_EXPORTS = [PACKAGE_EXPORT, "./metadata", "./gtk", "./adw"];

const resolveCodegenInputs = (cwd: string, config: Config): CodegenInputs => {
    const girPath = resolveGirPath(config.girPath);
    const libraries = resolveLibraries(config.libraries);
    const store = resolveCodegenStore(cwd);

    return { girPath, libraries, store };
};

const namespaceExport = (library: string): string => {
    const separator = library.indexOf("-");
    const namespace = (separator === -1 ? library : library.slice(0, separator)).toLowerCase();

    return `./${namespace}`;
};

const targetFiles = (target: ExportTarget): string[] =>
    typeof target === "string" ? [target] : Object.values(target).flatMap((nested) => targetFiles(nested));

const indexExtension = (target: string): string | undefined => {
    if (target.endsWith("/index.d.ts")) {
        return ".d.ts";
    }

    return target.endsWith("/index.js") ? ".js" : undefined;
};

const implementationFile = (target: string): string | undefined => {
    const extension = indexExtension(target);

    if (extension === undefined) {
        return undefined;
    }

    const directory = dirname(target);

    return join(directory, `${basename(directory)}${extension}`);
};

const generatedFiles = (exports: StoreExports): string[] =>
    Object.values(exports)
        .flatMap((target) => targetFiles(target))
        .flatMap((target) => {
            const implementation = implementationFile(target);

            return implementation === undefined ? [target] : [target, implementation];
        });

const hasStoreExports = (storeDir: string, required: string[], forbidden: string[] = []): boolean => {
    const manifestPath = join(storeDir, "package.json");

    if (!existsSync(manifestPath)) {
        return false;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        exports?: StoreExports;
    };
    const exports = manifest.exports;

    if (exports === undefined || required.some((key) => !Object.hasOwn(exports, key)) ||
        forbidden.some((key) => Object.hasOwn(exports, key))) {
        return false;
    }

    const files = generatedFiles(exports);

    return files.length > 0 && files.every((file) => existsSync(join(storeDir, file)));
};

const isGiStoreStale = (store: CodegenStore, libraries: string[]): boolean => {
    const required = [
        PACKAGE_EXPORT,
        ...resolveBoundLibraries(libraries).map((library) => namespaceExport(library)),
    ];

    return !hasStoreExports(store.giStoreDir, required);
};

const isReactStoreStale = (store: CodegenStore): boolean => {
    if (store.react === null) {
        return false;
    }

    return !hasStoreExports(store.jsxStoreDir, JSX_REQUIRED_EXPORTS, ["."]);
};

const isCodegenStale = (inputs: CodegenInputs): boolean => {
    try {
        return isGiStoreStale(inputs.store, inputs.libraries) || isReactStoreStale(inputs.store);
    } catch {
        return true;
    }
};

export { resolveCodegenInputs, isCodegenStale, type CodegenInputs };
