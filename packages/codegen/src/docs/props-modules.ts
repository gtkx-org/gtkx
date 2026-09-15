import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const PROPS_ORIGIN: string = fileURLToPath(import.meta.url);
const NODE_TYPES_ROOT = dirname(dirname(createRequire(import.meta.url).resolve("@types/node/package.json")));
const VIRTUAL_GI_ROOT: string = join(dirname(PROPS_ORIGIN), "__gtkx_reference_gi__");

const PROPS_COMPILER_OPTIONS: ts.CompilerOptions = {
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    noEmit: true,
    skipLibCheck: false,
    types: ["node"],
    typeRoots: [NODE_TYPES_ROOT],
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ["lib.esnext.d.ts"],
};

const resolvePropsModule = (specifier: string, containingFile: string): string => {
    const resolved = ts.resolveModuleName(specifier, containingFile, PROPS_COMPILER_OPTIONS, ts.sys).resolvedModule;

    if (resolved === undefined) {
        throw new Error(`Cannot resolve element prop declarations from ${specifier}`);
    }

    return resolved.resolvedFileName;
};

const declarationError = (diagnostics: readonly ts.Diagnostic[], root: string): Error =>
    new Error(ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
    }));

export { declarationError, PROPS_COMPILER_OPTIONS, PROPS_ORIGIN, resolvePropsModule, VIRTUAL_GI_ROOT };
