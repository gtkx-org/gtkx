import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";
import type { Library } from "../gir/library.js";
import type { ElementProps } from "../store/jsx/element-prop-imports.js";
import { transpileDeclaration } from "../compile.js";
import { generateGiNamespace } from "../gi.js";
import { externalPackageFor } from "../gir/external-namespaces.js";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import { collectStoreSources } from "../store/gi-store.js";
import { propsDependencies, type PropsDependencies, type PropsResolution } from "./props-dependencies.js";
import { declarationError, PROPS_COMPILER_OPTIONS, VIRTUAL_GI_ROOT } from "./props-modules.js";

type PropsProgramOptions = {
    library: Library;
    props: ElementProps;
    resolveFrom: string;
    declarationDir?: string | undefined;
};

type PropsExport = {
    glibName: string;
    name: string;
    fileName: string;
};

type PropsProgram = {
    program: ts.Program;
    exports: PropsExport[];
    dependencies: PropsDependencies;
    withSource: (fileName: string, source: string) => ts.Program;
};

type DeclarationModules = {
    sources: Map<string, string>;
    load: (directory: string) => void;
};

type PropsResolver = (specifier: string, containingFile: string) => ts.ResolvedModuleFull | undefined;

type ResolutionContext = {
    modules: DeclarationModules;
    host: ts.ModuleResolutionHost;
    cache: ts.ModuleResolutionCache;
    resolutions: Map<string, PropsResolution>;
};

type PropsModuleHost = Pick<
    ts.CompilerHost,
    "fileExists" | "readFile" | "directoryExists" | "realpath" | "getCurrentDirectory"
>;

const storedDeclarations = (root: string, directory: string): [string, string][] =>
    readdirSync(join(root, directory), { recursive: true, encoding: "utf8" })
        .filter((file) => file.endsWith(".d.ts"))
        .map((file) => [join(VIRTUAL_GI_ROOT, directory, file), readFileSync(join(root, directory, file), "utf8")]);

const generatedDeclarations = (namespace: GirNamespace, options: PropsProgramOptions): [string, string][] => {
    const { collected } = collectStoreSources([generateGiNamespace(namespace, options.library)]);

    return collected.map((source) => {
        const result = transpileDeclaration(source, true);

        if (result.diagnostics !== undefined && result.diagnostics.length > 0) {
            throw declarationError(result.diagnostics, options.resolveFrom);
        }

        return [join(VIRTUAL_GI_ROOT, source.fileName.replace(/\.ts$/, ".d.ts")), result.outputText];
    });
};

const declarationModules = (options: PropsProgramOptions): DeclarationModules => {
    const sources: Map<string, string> = new Map();
    const loaded: Set<string> = new Set();
    const namespaces = new Map(
        options.library.namespaces.values()
            .filter((namespace) => externalPackageFor(namespace.name) === undefined)
            .map((namespace) => [namespaceDirectory(namespace), namespace]),
    );
    const load = (directory: string): void => {
        if (loaded.has(directory)) {
            return;
        }

        loaded.add(directory);
        const namespace = namespaces.get(directory);

        if (namespace === undefined) {
            throw new Error(`The reference does not bind the ${directory} GIR namespace`);
        }

        const declarations = options.declarationDir === undefined
            ? generatedDeclarations(namespace, options)
            : storedDeclarations(options.declarationDir, directory);

        for (const [fileName, source] of declarations) {
            sources.set(fileName, source);
        }
    };

    return { sources, load };
};

const moduleHostFor = (
    options: PropsProgramOptions,
    modules: DeclarationModules,
    packageFiles: Map<string, string>,
): PropsModuleHost => ({
    fileExists: (fileName) => modules.sources.has(fileName) || ts.sys.fileExists(fileName),
    readFile: (fileName) => {
        const text = modules.sources.get(fileName) ?? packageFiles.get(fileName) ?? ts.sys.readFile(fileName);

        if (text !== undefined && fileName.endsWith("/package.json")) {
            packageFiles.set(fileName, text);
        }

        return text;
    },
    directoryExists: (path) => path.startsWith(VIRTUAL_GI_ROOT) || ts.sys.directoryExists(path),
    realpath: (path) => path.startsWith(VIRTUAL_GI_ROOT) ? path : ts.sys.realpath?.(path) ?? path,
    getCurrentDirectory: () => options.resolveFrom,
});

const virtualModule = (
    modules: DeclarationModules,
    specifier: string,
    containingFile: string,
): ts.ResolvedModuleFull | undefined => {
    if (specifier.startsWith("@gtkx/gi/")) {
        const directory = specifier.slice("@gtkx/gi/".length);
        modules.load(directory);

        return {
            resolvedFileName: join(VIRTUAL_GI_ROOT, directory, "index.d.ts"),
            extension: ts.Extension.Dts,
            isExternalLibraryImport: true,
        };
    }

    if (specifier.startsWith(".") && containingFile.startsWith(VIRTUAL_GI_ROOT)) {
        const target = resolve(dirname(containingFile), specifier).slice(VIRTUAL_GI_ROOT.length + 1);
        const [directory] = target.split("/", 1);

        if (directory !== undefined) {
            modules.load(directory);
        }
    }

    return undefined;
};

const resolveModule = (
    context: ResolutionContext,
    specifier: string,
    containingFile: string,
): ts.ResolvedModuleFull | undefined => {
    const generated = virtualModule(context.modules, specifier, containingFile);

    if (generated !== undefined) {
        return generated;
    }

    const resolved = ts.resolveModuleName(
        specifier,
        containingFile,
        PROPS_COMPILER_OPTIONS,
        context.host,
        context.cache,
    ).resolvedModule;

    if (!containingFile.startsWith(VIRTUAL_GI_ROOT)) {
        context.resolutions.set(JSON.stringify([specifier, containingFile]), {
            specifier,
            containingFile,
            fileName: resolved?.resolvedFileName ?? null,
        });
    }

    return resolved;
};

const compilerHost = (
    options: PropsProgramOptions,
    modules: DeclarationModules,
    packageFiles: Map<string, string>,
    resolutions: Map<string, PropsResolution>,
): { host: ts.CompilerHost; resolve: PropsResolver } => {
    const defaultHost = ts.createCompilerHost(PROPS_COMPILER_OPTIONS);
    const sourceFiles: Map<string, ts.SourceFile> = new Map();
    const moduleHost = moduleHostFor(options, modules, packageFiles);
    const context: ResolutionContext = {
        modules,
        host: moduleHost,
        resolutions,
        cache: ts.createModuleResolutionCache(options.resolveFrom, (name) => name, PROPS_COMPILER_OPTIONS),
    };
    const resolve: PropsResolver = (specifier, containingFile) => resolveModule(context, specifier, containingFile);
    const host: ts.CompilerHost = {
        ...defaultHost,
        ...moduleHost,
        getSourceFile: (fileName, version, onError, shouldCreateNewSourceFile) => {
            const cached = sourceFiles.get(fileName);

            if (cached !== undefined && shouldCreateNewSourceFile !== true) {
                return cached;
            }

            const text = modules.sources.get(fileName);
            const source = text === undefined
                ? defaultHost.getSourceFile(fileName, version, onError, shouldCreateNewSourceFile)
                : ts.createSourceFile(fileName, text, version, true);

            if (source !== undefined) {
                sourceFiles.set(fileName, source);
            }

            return source;
        },
        resolveModuleNameLiterals: (literals, containingFile) =>
            literals.map((literal) => ({ resolvedModule: resolve(literal.text, containingFile) })),
    };

    return { host, resolve };
};

const resolveExports = (options: PropsProgramOptions, resolver: PropsResolver): PropsExport[] =>
    Object.entries(options.props).map(([glibName, ref]) => {
        const resolved = resolver(ref.module, join(options.resolveFrom, "gtkx.config.ts"));

        if (resolved === undefined) {
            throw new Error(`Cannot resolve ${ref.module}, which declares the ${ref.export} element props`);
        }

        return { glibName, name: ref.export, fileName: resolved.resolvedFileName };
    });

const checkSources = (program: ts.Program, modules: DeclarationModules): [string, string][] => {
    const sources = program.getSourceFiles().filter((source) =>
        !modules.sources.has(source.fileName) && !program.isSourceFileDefaultLibrary(source));
    const diagnostics = [
        ...program.getOptionsDiagnostics(),
        ...program.getGlobalDiagnostics(),
        ...sources.flatMap((source) => [
            ...program.getSyntacticDiagnostics(source),
            ...program.getSemanticDiagnostics(source),
        ]),
    ];

    if (diagnostics.length > 0) {
        throw declarationError(diagnostics, program.getCurrentDirectory());
    }

    return sources.map((source) => [source.fileName, source.text]);
};

const createPropsProgram = (options: PropsProgramOptions): PropsProgram => {
    const modules = declarationModules(options);
    const resolutions: Map<string, PropsResolution> = new Map();
    const packageFiles: Map<string, string> = new Map();
    const { host, resolve } = compilerHost(options, modules, packageFiles, resolutions);
    const exports = resolveExports(options, resolve);
    const program = ts.createProgram({
        rootNames: [...new Set(exports.map((entry) => entry.fileName))],
        options: PROPS_COMPILER_OPTIONS,
        host,
    });
    const files = new Map([...checkSources(program, modules), ...packageFiles]);

    const withSource = (fileName: string, source: string): ts.Program => {
        modules.sources.set(fileName, source);

        return ts.createProgram({
            rootNames: [...program.getRootFileNames(), fileName],
            options: PROPS_COMPILER_OPTIONS,
            host,
            oldProgram: program,
        });
    };

    return { program, exports, dependencies: propsDependencies(files, resolutions.values().toArray()), withSource };
};

export { createPropsProgram, type PropsExport, type PropsProgramOptions };
