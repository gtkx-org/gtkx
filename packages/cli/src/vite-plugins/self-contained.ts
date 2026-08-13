import type { Plugin } from "vite";
import { isRecord } from "@gtkx/utils";
import { isBuiltin } from "node:module";
import { posix } from "node:path";
import { parseSync } from "vite";

type AstNode = Record<string, unknown>;

type Bindings = {
    declarations: Map<string, number>;
    factories: Set<string>;
    requires: Set<string>;
    urls: Set<string>;
};

type Scan = {
    bindings: Bindings;
    calls: AstNode[];
    sources: string[];
};

type Chunk = {
    fileName: string;
    code: string;
};

const REQUIRE_FACTORY = "createRequire";
const REQUIRE_BINDING = "require";
const RESOLVE_PROPERTY = "resolve";
const MODULE_BUILTIN = "node:module";
const OUTPUT_DIRECTORY = ".";
const RELATIVE_SPECIFIER = /^\.\.?(?:\/|$)/;
const DECLARATION_KEYS = ["id", "local", "param", "params"];

const SOURCE_STATEMENTS = new Set([
    "ExportAllDeclaration",
    "ExportNamedDeclaration",
    "ImportDeclaration",
    "ImportExpression",
]);

const isAstNode = (value: unknown): value is AstNode => isRecord(value) && typeof value.type === "string";
const nodeType = (node: AstNode): string => (typeof node.type === "string" ? node.type : "");

const nodeName = (node: AstNode | null): string | null =>
    node !== null && typeof node.name === "string" ? node.name : null;

const childNode = (node: AstNode, key: string): AstNode | null => {
    const value = node[key];

    return isAstNode(value) ? value : null;
};

const childNodes = (node: AstNode, key: string): AstNode[] => {
    const value = node[key];

    if (!Array.isArray(value)) {
        return [];
    }

    const entries: unknown[] = value;

    return entries.filter(isAstNode);
};

const childValues = (value: unknown): unknown[] => {
    if (Array.isArray(value)) {
        const entries: unknown[] = value;

        return entries;
    }

    if (!isAstNode(value)) {
        return [];
    }

    return Object.values(value).filter((child) => typeof child === "object" && child !== null);
};

const visitNode = (value: unknown, visit: (node: AstNode) => void): void => {
    if (isAstNode(value)) {
        visit(value);
    }
};

const walk = (root: unknown, visit: (node: AstNode) => void): void => {
    const stack: unknown[] = [root];

    while (stack.length > 0) {
        const current = stack.pop();
        visitNode(current, visit);

        for (const value of childValues(current)) {
            stack.push(value);
        }
    }
};

const countName = (declarations: Map<string, number>, node: AstNode): void => {
    const name = nodeName(node);

    if (name !== null) {
        declarations.set(name, (declarations.get(name) ?? 0) + 1);
    }
};

const countDeclarations = (node: AstNode, declarations: Map<string, number>): void => {
    for (const key of DECLARATION_KEYS) {
        walk(node[key], (declared) => {
            countName(declarations, declared);
        });
    }
};

const isUnshadowed = (name: string, bindings: Bindings): boolean => (bindings.declarations.get(name) ?? 0) <= 1;

const templateString = (node: AstNode): string | null => {
    if (childNodes(node, "expressions").length > 0) {
        return null;
    }

    const [quasi] = childNodes(node, "quasis");
    const value = quasi === undefined ? null : quasi.value;

    return isRecord(value) && typeof value.cooked === "string" ? value.cooked : null;
};

const literalString = (node: AstNode | null): string | null => {
    if (node === null) {
        return null;
    }

    if (nodeType(node) === "Literal") {
        return typeof node.value === "string" ? node.value : null;
    }

    return nodeType(node) === "TemplateLiteral" ? templateString(node) : null;
};

const isMetaUrl = (node: AstNode, bindings: Bindings): boolean => {
    if (nodeType(node) === "MemberExpression") {
        const object = childNode(node, "object");

        return object !== null && nodeType(object) === "MetaProperty";
    }

    const name = nodeName(node);

    return name !== null && bindings.urls.has(name) && isUnshadowed(name, bindings);
};

const hasMetaUrl = (node: AstNode, bindings: Bindings): boolean =>
    childNodes(node, "arguments").some((argument) => isMetaUrl(argument, bindings));

const isRequireName = (name: string | null, bindings: Bindings): boolean =>
    name !== null && (name === REQUIRE_BINDING || bindings.requires.has(name)) && isUnshadowed(name, bindings);

const isFactoryName = (name: string | null, bindings: Bindings): boolean =>
    name !== null && (name === REQUIRE_FACTORY || bindings.factories.has(name)) && isUnshadowed(name, bindings);

const isRequireFactory = (node: AstNode, bindings: Bindings): boolean => {
    if (nodeType(node) !== "CallExpression") {
        return false;
    }

    return isFactoryName(nodeName(childNode(node, "callee")), bindings) || hasMetaUrl(node, bindings);
};

const isResolveTarget = (object: AstNode, bindings: Bindings): boolean =>
    nodeType(object) === "MetaProperty" ||
    isRequireName(nodeName(object), bindings) ||
    isRequireFactory(object, bindings);

const isResolveMember = (callee: AstNode, bindings: Bindings): boolean => {
    if (nodeType(callee) !== "MemberExpression" || callee.computed === true) {
        return false;
    }

    if (nodeName(childNode(callee, "property")) !== RESOLVE_PROPERTY) {
        return false;
    }

    const object = childNode(callee, "object");

    return object !== null && isResolveTarget(object, bindings);
};

const isResolvingCall = (call: AstNode, bindings: Bindings): boolean => {
    if (hasMetaUrl(call, bindings)) {
        return true;
    }

    const callee = childNode(call, "callee");

    if (callee === null) {
        return false;
    }

    return (
        isRequireName(nodeName(callee), bindings) ||
        isRequireFactory(callee, bindings) ||
        isResolveMember(callee, bindings)
    );
};

const collectFactories = (node: AstNode, bindings: Bindings): void => {
    if (literalString(childNode(node, "source")) !== MODULE_BUILTIN) {
        return;
    }

    for (const specifier of childNodes(node, "specifiers")) {
        const local = nodeName(childNode(specifier, "local"));

        if (local !== null && nodeName(childNode(specifier, "imported")) === REQUIRE_FACTORY) {
            bindings.factories.add(local);
        }
    }
};

const collectBinding = (node: AstNode, bindings: Bindings): void => {
    const name = nodeName(childNode(node, "id"));
    const init = childNode(node, "init");

    if (name === null || init === null) {
        return;
    }

    if (isMetaUrl(init, bindings)) {
        bindings.urls.add(name);
    }

    if (isRequireFactory(init, bindings)) {
        bindings.requires.add(name);
    }
};

const hasStringArgument = (call: AstNode): boolean =>
    childNodes(call, "arguments").some((argument) => literalString(argument) !== null);

const collectSource = (scan: Scan, node: AstNode, type: string): void => {
    if (!SOURCE_STATEMENTS.has(type)) {
        return;
    }

    const source = literalString(childNode(node, "source"));

    if (source !== null) {
        scan.sources.push(source);
    }
};

const collectCall = (scan: Scan, node: AstNode, type: string): void => {
    if (type === "CallExpression" && hasStringArgument(node)) {
        scan.calls.push(node);
    }
};

const scanNode = (scan: Scan, node: AstNode): void => {
    const type = nodeType(node);
    countDeclarations(node, scan.bindings.declarations);

    if (type === "ImportDeclaration") {
        collectFactories(node, scan.bindings);
    } else if (type === "VariableDeclarator") {
        collectBinding(node, scan.bindings);
    }

    collectSource(scan, node, type);
    collectCall(scan, node, type);
};

const scanChunk = (chunk: Chunk): Scan => {
    const scan: Scan = {
        bindings: { declarations: new Map(), factories: new Set(), requires: new Set(), urls: new Set() },
        calls: [],
        sources: [],
    };

    walk(parseSync(chunk.fileName, chunk.code).program, (node) => {
        scanNode(scan, node);
    });

    return scan;
};

const callSpecifiers = (scan: Scan): string[] =>
    scan.calls
        .filter((call) => isResolvingCall(call, scan.bindings))
        .flatMap((call) => childNodes(call, "arguments"))
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
