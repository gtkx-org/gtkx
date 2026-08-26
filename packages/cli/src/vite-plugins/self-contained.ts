import type { ESTree, Plugin, VisitorObject } from "vite";
import { isBuiltin } from "node:module";
import { posix } from "node:path";
import { parseSync, Visitor } from "vite";

type Bindings = {
    declarations: Map<string, number>;
    factories: Set<string>;
    requires: Set<string>;
    urls: Set<string>;
};

type Scan = {
    bindings: Bindings;
    calls: ESTree.CallExpression[];
    sources: string[];
};

type Chunk = {
    fileName: string;
    code: string;
};

type PatternItem =
    | ESTree.BindingPattern |
    ESTree.BindingProperty |
    ESTree.BindingRestElement |
    ESTree.FormalParameterRest |
    ESTree.TSParameterProperty |
    null;

const REQUIRE_FACTORY = "createRequire";
const REQUIRE_BINDING = "require";
const RESOLVE_PROPERTY = "resolve";
const MODULE_BUILTIN = "node:module";
const OUTPUT_DIRECTORY = ".";
const RELATIVE_SPECIFIER = /^\.\.?(?:\/|$)/;

const exportName = (name: ESTree.ModuleExportName): string | null => (name.type === "Identifier" ? name.name : null);
const referenceName = (node: ESTree.Argument): string | null => (node.type === "Identifier" ? node.name : null);

const countName = (declarations: Map<string, number>, name: string | null): void => {
    if (name !== null) {
        declarations.set(name, (declarations.get(name) ?? 0) + 1);
    }
};

const boundPattern = (item: PatternItem): ESTree.BindingPattern | null => {
    if (item === null) {
        return null;
    }

    if (item.type === "Property") {
        return item.value;
    }

    if (item.type === "RestElement") {
        return item.argument;
    }

    return item.type === "TSParameterProperty" ? item.parameter : item;
};

const countPatterns = (declarations: Map<string, number>, items: PatternItem[]): void => {
    for (const item of items) {
        countPattern(declarations, boundPattern(item));
    }
};

const countPattern = (declarations: Map<string, number>, pattern: ESTree.BindingPattern | null): void => {
    if (pattern === null) {
        return;
    }

    if (pattern.type === "Identifier") {
        countName(declarations, pattern.name);

        return;
    }

    if (pattern.type === "AssignmentPattern") {
        countPattern(declarations, pattern.left);

        return;
    }

    countPatterns(declarations, pattern.type === "ObjectPattern" ? pattern.properties : pattern.elements);
};

const countFunction = (
    declarations: Map<string, number>,
    node: ESTree.ArrowFunctionExpression | ESTree.Function,
): void => {
    countPattern(declarations, node.id);
    countPatterns(declarations, node.params);
};

const declarationVisitor = (declarations: Map<string, number>): VisitorObject => ({
    ArrowFunctionExpression: (node) => {
        countFunction(declarations, node);
    },
    CatchClause: (node) => {
        countPattern(declarations, node.param);
    },
    ClassDeclaration: (node) => {
        countPattern(declarations, node.id);
    },
    ClassExpression: (node) => {
        countPattern(declarations, node.id);
    },
    ExportSpecifier: (node) => {
        countName(declarations, exportName(node.local));
    },
    FunctionDeclaration: (node) => {
        countFunction(declarations, node);
    },
    FunctionExpression: (node) => {
        countFunction(declarations, node);
    },
    ImportDefaultSpecifier: (node) => {
        countPattern(declarations, node.local);
    },
    ImportNamespaceSpecifier: (node) => {
        countPattern(declarations, node.local);
    },
    ImportSpecifier: (node) => {
        countPattern(declarations, node.local);
    },
    VariableDeclarator: (node) => {
        countPattern(declarations, node.id);
    },
});

const isUnshadowed = (name: string, bindings: Bindings): boolean => (bindings.declarations.get(name) ?? 0) <= 1;

const templateString = (node: ESTree.TemplateLiteral): string | null => {
    const [quasi] = node.quasis;

    return quasi === undefined || node.expressions.length > 0 ? null : quasi.value.cooked;
};

const literalString = (node: ESTree.Argument | null): string | null => {
    if (node?.type === "TemplateLiteral") {
        return templateString(node);
    }

    return node?.type === "Literal" && typeof node.value === "string" ? node.value : null;
};

const isMetaUrl = (node: ESTree.Argument, bindings: Bindings): boolean => {
    if (node.type === "MemberExpression") {
        return node.object.type === "MetaProperty";
    }

    const name = referenceName(node);

    return name !== null && bindings.urls.has(name) && isUnshadowed(name, bindings);
};

const hasMetaUrl = (node: ESTree.CallExpression, bindings: Bindings): boolean =>
    node.arguments.some((argument) => isMetaUrl(argument, bindings));

const isRequireName = (name: string | null, bindings: Bindings): boolean =>
    name !== null && (name === REQUIRE_BINDING || bindings.requires.has(name)) && isUnshadowed(name, bindings);

const isFactoryName = (name: string | null, bindings: Bindings): boolean =>
    name !== null && (name === REQUIRE_FACTORY || bindings.factories.has(name)) && isUnshadowed(name, bindings);

const isRequireFactory = (node: ESTree.Argument, bindings: Bindings): boolean =>
    node.type === "CallExpression" &&
    (isFactoryName(referenceName(node.callee), bindings) || hasMetaUrl(node, bindings));

const isResolveTarget = (object: ESTree.Expression, bindings: Bindings): boolean =>
    object.type === "MetaProperty" ||
    isRequireName(referenceName(object), bindings) ||
    isRequireFactory(object, bindings);

const isResolveMember = (callee: ESTree.Expression, bindings: Bindings): boolean =>
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    callee.property.name === RESOLVE_PROPERTY &&
    isResolveTarget(callee.object, bindings);

const isResolvingCall = (call: ESTree.CallExpression, bindings: Bindings): boolean =>
    hasMetaUrl(call, bindings) ||
    isRequireName(referenceName(call.callee), bindings) ||
    isRequireFactory(call.callee, bindings) ||
    isResolveMember(call.callee, bindings);

const collectFactories = (node: ESTree.ImportDeclaration, bindings: Bindings): void => {
    if (node.source.value !== MODULE_BUILTIN) {
        return;
    }

    for (const specifier of node.specifiers) {
        if (specifier.type === "ImportSpecifier" && exportName(specifier.imported) === REQUIRE_FACTORY) {
            bindings.factories.add(specifier.local.name);
        }
    }
};

const collectBinding = (node: ESTree.VariableDeclarator, bindings: Bindings): void => {
    const { id, init } = node;

    if (init === null || id.type !== "Identifier") {
        return;
    }

    if (isMetaUrl(init, bindings)) {
        bindings.urls.add(id.name);
    }

    if (isRequireFactory(init, bindings)) {
        bindings.requires.add(id.name);
    }
};

const collectSource = (scan: Scan, source: string | null): void => {
    if (source !== null) {
        scan.sources.push(source);
    }
};

const collectCall = (scan: Scan, node: ESTree.CallExpression): void => {
    if (node.arguments.some((argument) => literalString(argument) !== null)) {
        scan.calls.push(node);
    }
};

const scanVisitor = (scan: Scan): VisitorObject => ({
    CallExpression: (node) => {
        collectCall(scan, node);
    },
    ExportAllDeclaration: (node) => {
        collectSource(scan, node.source.value);
    },
    ExportNamedDeclaration: (node) => {
        collectSource(scan, node.source?.value ?? null);
    },
    ImportDeclaration: (node) => {
        collectFactories(node, scan.bindings);
        collectSource(scan, node.source.value);
    },
    ImportExpression: (node) => {
        collectSource(scan, literalString(node.source));
    },
    VariableDeclarator: (node) => {
        collectBinding(node, scan.bindings);
    },
});

const scanChunk = (chunk: Chunk): Scan => {
    const scan: Scan = {
        bindings: { declarations: new Map(), factories: new Set(), requires: new Set(), urls: new Set() },
        calls: [],
        sources: [],
    };

    const { program } = parseSync(chunk.fileName, chunk.code);
    new Visitor(declarationVisitor(scan.bindings.declarations)).visit(program);
    new Visitor(scanVisitor(scan)).visit(program);

    return scan;
};

const callSpecifiers = (scan: Scan): string[] =>
    scan.calls
        .filter((call) => isResolvingCall(call, scan.bindings))
        .flatMap((call) => call.arguments)
        .map((argument) => literalString(argument))
        .filter((specifier) => specifier !== null);

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
    const scan = scanChunk(chunk);
    const directory = posix.dirname(chunk.fileName);

    return new Set([...scan.sources, ...callSpecifiers(scan)])
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
