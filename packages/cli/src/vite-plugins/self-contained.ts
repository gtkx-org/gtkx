import type { Plugin } from "vite";
import { type NodePath, parseSync, type Scope, traverse } from "@babel/core";
import { isBuiltin } from "node:module";
import { posix } from "node:path";

type BindingKind = "factory" | "module" | "require" | "url";

type ResolvedBinding = NonNullable<ReturnType<Scope["getBinding"]>>;

type Scan = {
    sources: string[];
};

type Chunk = {
    fileName: string;
    code: string;
};

const REQUIRE_FACTORY = "createRequire";
const REQUIRE_BINDING = "require";
const RESOLVE_PROPERTY = "resolve";
const URL_PROPERTY = "url";
const MODULE_BUILTINS = new Set(["module", "node:module"]);
const OUTPUT_DIRECTORY = ".";
const RELATIVE_SPECIFIER = /^\.\.?(?:\/|$)/;

const importedName = (path: NodePath): string | null => {
    if (!path.isImportSpecifier()) {
        return null;
    }

    const { imported } = path.node;

    return imported.type === "Identifier" ? imported.name : imported.value;
};

const importKind = (path: NodePath): BindingKind | null => {
    const declaration = path.parentPath;

    if (!declaration.isImportDeclaration() || !MODULE_BUILTINS.has(declaration.node.source.value)) {
        return null;
    }

    if (importedName(path) === REQUIRE_FACTORY) {
        return "factory";
    }

    return path.isImportNamespaceSpecifier() || path.isImportDefaultSpecifier() ? "module" : null;
};

const memberName = (path: NodePath): string | null => {
    if (!path.isMemberExpression()) {
        return null;
    }

    const property = path.get("property");

    if (path.node.computed) {
        return property.isStringLiteral() ? property.node.value : null;
    }

    return property.isIdentifier() ? property.node.name : null;
};

const isImportMeta = (path: NodePath): boolean =>
    path.isMetaProperty() && path.node.meta.name === "import" && path.node.property.name === "meta";

const isDirectMetaUrl = (path: NodePath): boolean => {
    if (!path.isMemberExpression() || memberName(path) !== URL_PROPERTY) {
        return false;
    }

    const object = path.get("object");

    return isImportMeta(object);
};

const bindingKind = (binding: ResolvedBinding, seen: Set<ResolvedBinding>): BindingKind | null => {
    if (seen.has(binding)) {
        return null;
    }

    const next = new Set(seen).add(binding);
    const imported = importKind(binding.path);

    if (imported !== null) {
        return imported;
    }

    if (!binding.path.isVariableDeclarator()) {
        return null;
    }

    const initializer = binding.path.get("init");

    return initializer.node === null ? null : expressionKind(initializer, next);
};

const nameKind = (scope: Scope, name: string, seen: Set<ResolvedBinding>): BindingKind | null => {
    const binding = scope.getBinding(name);

    if (binding !== undefined) {
        return bindingKind(binding, seen);
    }

    if (name === REQUIRE_FACTORY) {
        return "factory";
    }

    return name === REQUIRE_BINDING ? "require" : null;
};

const isModuleExpression = (path: NodePath, seen: Set<ResolvedBinding>): boolean => {
    if (path.isIdentifier()) {
        return nameKind(path.scope, path.node.name, seen) === "module";
    }

    if (!path.isCallExpression()) {
        return false;
    }

    const [source] = path.get("arguments");
    const callee = path.get("callee");
    const sourceName = source === undefined ? null : literalString(source);

    return (
        sourceName !== null &&
        MODULE_BUILTINS.has(sourceName) &&
        isRequireExpression(callee, seen)
    );
};

const isFactoryExpression = (path: NodePath, seen: Set<ResolvedBinding>): boolean => {
    if (path.isIdentifier()) {
        return nameKind(path.scope, path.node.name, seen) === "factory";
    }

    if (!path.isMemberExpression() || memberName(path) !== REQUIRE_FACTORY) {
        return false;
    }

    return isModuleExpression(path.get("object"), seen);
};

const isRequireFactoryCall = (path: NodePath, seen: Set<ResolvedBinding>): boolean => {
    if (!path.isCallExpression()) {
        return false;
    }

    const callee = path.get("callee");

    return isFactoryExpression(callee, seen);
};

const expressionKind = (path: NodePath, seen: Set<ResolvedBinding>): BindingKind | null => {
    if (isDirectMetaUrl(path)) {
        return "url";
    }

    if (path.isIdentifier()) {
        return nameKind(path.scope, path.node.name, seen);
    }

    if (isFactoryExpression(path, seen)) {
        return "factory";
    }

    if (isModuleExpression(path, seen)) {
        return "module";
    }

    return isRequireFactoryCall(path, seen) ? "require" : null;
};

const isMetaUrl = (path: NodePath): boolean =>
    isDirectMetaUrl(path) ||
    (path.isIdentifier() && nameKind(path.scope, path.node.name, new Set()) === "url");

const isRequireExpression = (path: NodePath, seen: Set<ResolvedBinding> = new Set()): boolean =>
    isRequireFactoryCall(path, seen) ||
    (path.isIdentifier() && nameKind(path.scope, path.node.name, seen) === "require");

const hasMetaUrlArgument = (path: NodePath): boolean => {
    if (!path.isCallExpression()) {
        return false;
    }

    return path.get("arguments").some((argument) => isMetaUrl(argument));
};

const isResolveMember = (path: NodePath): boolean => {
    if (!path.isMemberExpression() || memberName(path) !== RESOLVE_PROPERTY) {
        return false;
    }

    const object = path.get("object");

    return isImportMeta(object) || isRequireExpression(object);
};

const isResolvingCall = (path: NodePath): boolean => {
    if (!path.isCallExpression()) {
        return false;
    }

    const callee = path.get("callee");

    return hasMetaUrlArgument(path) || isRequireExpression(callee) || isResolveMember(callee);
};

const literalString = (path: NodePath): string | null => {
    if (path.isStringLiteral()) {
        return path.node.value;
    }

    if (!path.isTemplateLiteral() || path.node.expressions.length > 0) {
        return null;
    }

    return path.node.quasis[0]?.value.cooked ?? null;
};

const collectSource = (scan: Scan, source: string | null): void => {
    if (source !== null) {
        scan.sources.push(source);
    }
};

const collectCallSources = (scan: Scan, path: NodePath): void => {
    if (!isResolvingCall(path) || !path.isCallExpression()) {
        return;
    }

    for (const argument of path.get("arguments")) {
        collectSource(scan, literalString(argument));
    }
};

const scanChunk = (chunk: Chunk): Scan => {
    const scan: Scan = { sources: [] };
    const ast = parseSync(chunk.code, {
        ast: true,
        babelrc: false,
        configFile: false,
        filename: chunk.fileName,
        sourceType: "module",
    });

    if (ast === null) {
        throw new Error(`Cannot inspect ${chunk.fileName}`);
    }

    traverse(ast, {
        CallExpression: (path) => {
            collectCallSources(scan, path);
        },
        ExportAllDeclaration: (path) => {
            collectSource(scan, path.node.source.value);
        },
        ExportNamedDeclaration: (path) => {
            collectSource(scan, path.node.source?.value ?? null);
        },
        ImportDeclaration: (path) => {
            collectSource(scan, path.node.source.value);
        },
        ImportExpression: (path) => {
            collectSource(scan, literalString(path.get("source")));
        },
    });

    return scan;
};

const isReachable = (specifier: string, directory: string, emitted: Set<string>): boolean => {
    if (isBuiltin(specifier)) {
        return true;
    }

    if (!RELATIVE_SPECIFIER.test(specifier)) {
        return false;
    }

    const target = posix.normalize(posix.join(directory, specifier));

    return target === OUTPUT_DIRECTORY || emitted.has(target);
};

const unreachableSpecifiers = (chunk: Chunk, emitted: Set<string>): string[] => {
    const directory = posix.dirname(chunk.fileName);

    return new Set(scanChunk(chunk).sources)
        .values()
        .filter((specifier) => !isReachable(specifier, directory, emitted))
        .toArray()
        .toSorted((left, right) => left.localeCompare(right));
};

const assertSelfContained = (chunk: Chunk, emitted: Set<string>): void => {
    const specifiers = unreachableSpecifiers(chunk, emitted);

    if (specifiers.length === 0) {
        return;
    }

    throw new Error(
        [
            `${chunk.fileName} resolves ${specifiers.join(", ")} at runtime,`,
            "so the built app only starts where that resolution succeeds from wherever it was installed.",
            "The artifact may resolve node: builtins and the files the build emits beside it, nothing else:",
            "bundle the module, emit the file, or read the data at build time.",
        ].join(" "),
    );
};

function gtkxSelfContained(): Plugin {
    return {
        name: "gtkx:self-contained",
        apply: "build",

        generateBundle(_options, bundle) {
            const emitted = new Set(Object.keys(bundle));

            for (const output of Object.values(bundle)) {
                if (output.type === "chunk") {
                    assertSelfContained({ fileName: output.fileName, code: output.code }, emitted);
                }
            }
        },
    };
}

export { gtkxSelfContained };
