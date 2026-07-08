import { join, relative, resolve } from "node:path";
import ts from "typescript";

export type StoreSourceFile = {
    fileName: string;
    source: string;
};

export type TypecheckStoreParams = {
    storeDir: string;
    files: StoreSourceFile[];
    packageName: string;
    exports: Record<string, unknown>;
    resolveFrom: string;
};

const GENERATED_PACKAGES = ["@gtkx/gi", "@gtkx/jsx"];

const COMPILER_FLAGS = {
    module: "esnext",
    moduleResolution: "bundler",
    target: "esnext",
    lib: ["esnext"],
    jsx: "react-jsx",
    jsxImportSource: "react",
    customConditions: ["source"],
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    allowUnreachableCode: false,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    skipDefaultLibCheck: true,
    types: ["node"],
    noEmit: true,
};

const isGenerated = (specifier: string, pkg: string): boolean => specifier === pkg || specifier.startsWith(`${pkg}/`);

const isGeneratedSpecifier = (specifier: string): boolean =>
    GENERATED_PACKAGES.some((pkg) => isGenerated(specifier, pkg));

const isExternalSpecifier = (specifier: string): boolean =>
    !specifier.startsWith(".") && !isGeneratedSpecifier(specifier);

const selfPaths = (
    packageName: string,
    exportsMap: Record<string, unknown>,
    storeDir: string,
): Record<string, string[]> => {
    const paths: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(exportsMap)) {
        if (key === "./package.json" || typeof value !== "object" || value === null) continue;
        const target = (value as { default?: unknown }).default;
        if (typeof target !== "string") continue;
        const stem = target.replace(/^\.\//, "").replace(/\.js$/, "");
        paths[`${packageName}${key.slice(1)}`] = [join(storeDir, stem)];
    }
    return paths;
};

const buildOptions = (params: TypecheckStoreParams): ts.CompilerOptions => {
    const { options, errors } = ts.convertCompilerOptionsFromJson(COMPILER_FLAGS, params.storeDir);
    if (errors.length > 0) {
        const text = errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n");
        throw new Error(`Invalid codegen typecheck options:\n${text}`);
    }
    options.baseUrl = params.storeDir;
    options.paths = selfPaths(params.packageName, params.exports, params.storeDir);
    return options;
};

const createHost = (options: ts.CompilerOptions, resolveFrom: string, storeDir: string): ts.CompilerHost => {
    const host = ts.createCompilerHost(options, true);
    const cache = ts.createModuleResolutionCache(
        host.getCurrentDirectory(),
        (name) => host.getCanonicalFileName(name),
        options,
    );
    const externalOrigin = join(resolveFrom, "__gtkx_codegen_typecheck__.ts");
    const generatedOrigin = join(storeDir, "__gtkx_codegen_generated__.ts");
    const resolve = (
        name: string,
        origin: string,
        redirected: ts.ResolvedProjectReference | undefined,
        mode: ts.ResolutionMode,
    ) => ts.resolveModuleName(name, origin, options, host, cache, redirected, mode);
    // biome-ignore lint/complexity/useMaxParams: TypeScript's CompilerHost.resolveModuleNameLiterals dictates this arity.
    host.resolveModuleNameLiterals = (
        moduleLiterals,
        containingFile,
        redirectedReference,
        _compilerOptions,
        containingSourceFile,
    ) =>
        moduleLiterals.map((literal) => {
            const name = literal.text;
            const mode = ts.getModeForUsageLocation(containingSourceFile, literal, options);
            if (isGeneratedSpecifier(name)) return resolve(name, generatedOrigin, redirectedReference, mode);
            const local = resolve(name, containingFile, redirectedReference, mode);
            if (local.resolvedModule !== undefined || !isExternalSpecifier(name)) return local;
            return resolve(name, externalOrigin, redirectedReference, mode);
        });
    return host;
};

const formatDiagnostics = (packageName: string, storeDir: string, diagnostics: ts.Diagnostic[]): string => {
    const messages = diagnostics.map((diagnostic) => {
        const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
        if (diagnostic.file && diagnostic.start !== undefined) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            return `${relative(storeDir, diagnostic.file.fileName)}:${line + 1}:${character + 1} - ${text} (TS${diagnostic.code})`;
        }
        return `${text} (TS${diagnostic.code})`;
    });
    return `Type checking the generated ${packageName} store found ${diagnostics.length} error(s):\n${messages.join("\n")}`;
};

export const typecheckStore = (params: TypecheckStoreParams): void => {
    const options = buildOptions(params);
    const host = createHost(options, params.resolveFrom, params.storeDir);
    const rootNames = params.files.map((file) => resolve(params.storeDir, file.fileName));
    const program = ts.createProgram({ rootNames, options, host });

    const diagnostics: ts.Diagnostic[] = [];
    for (const rootName of rootNames) {
        const sourceFile = program.getSourceFile(rootName);
        if (sourceFile === undefined) continue;
        diagnostics.push(...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile));
    }

    if (diagnostics.length > 0) {
        throw new Error(formatDiagnostics(params.packageName, params.storeDir, diagnostics));
    }
};
