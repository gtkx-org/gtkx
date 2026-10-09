import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { toCamelIdentifier } from "@gtkx/utils";
import {
    attr,
    getChild,
    getChildren,
    GIR_CONSTRUCTOR_TAG,
    parseGirFile,
    type RawNode,
} from "../../../codegen/src/gir/parse.js";

type Namespace = "GIMarshallingTests" | "Regress";
type Callable = { symbol: string; owner: string; name: string; node: RawNode; introspectable: boolean };
type Signal = { owner: string; name: string; node: RawNode; introspectable: boolean };
type CallableOmission = { symbol: string; owner: string; name: string };
type SignalOmission = { owner: string; name: string };
type Member = { owner: string; name: string; node: RawNode; introspectable: boolean };
type PropertyOmission = { owner: string; name: string; missing: ("read" | "write" | "construct")[] };

type NativeFixtureOmissions = {
    namespace: Namespace;
    callableCount: number;
    generatedCallableCount: number;
    omittedCallables: CallableOmission[];
    scannerExcludedCallables: string[];
    missingNativeSymbols: string[];
    signalCount: number;
    generatedSignalCount: number;
    omittedSignals: SignalOmission[];
    scannerExcludedSignals: string[];
    propertyCount: number;
    generatedPropertyCount: number;
    omittedProperties: PropertyOmission[];
    scannerExcludedProperties: string[];
    virtualMethodCount: number;
    generatedVirtualMethodCount: number;
    omittedVirtualMethods: SignalOmission[];
    scannerExcludedVirtualMethods: string[];
    lifecycleVirtualMethods: string[];
};

const namespaces: Namespace[] = ["GIMarshallingTests", "Regress"];
const ownerTags = ["class", "interface", "record", "union", "enumeration", "bitfield"];
const callableTags = ["function", "method", GIR_CONSTRUCTOR_TAG];
const rawDeclarations = (namespace: RawNode, namespaceName: string) => {
    const callables: Callable[] = [];
    const signals: Signal[] = [];
    const properties: Member[] = [];
    const virtualMethods: Member[] = [];
    const visit = (node: RawNode, owner: string, parentIntrospectable: boolean): void => {
        const introspectable = parentIntrospectable && attr(node, "introspectable") !== "0";
        for (const tag of callableTags) {
            for (const callable of getChildren(node, tag)) {
                const symbol = attr(callable, "c:identifier");
                const name = attr(callable, "name");
                if (symbol !== undefined && name !== undefined) {
                    callables.push({
                        symbol,
                        owner,
                        name,
                        node: callable,
                        introspectable: introspectable && attr(callable, "introspectable") !== "0",
                    });
                }
            }
        }
        for (const signal of getChildren(node, "glib:signal")) {
            const name = attr(signal, "name");
            if (name !== undefined) {
                signals.push({
                    owner,
                    name,
                    node: signal,
                    introspectable: introspectable && attr(signal, "introspectable") !== "0",
                });
            }
        }
        for (const [tag, members] of [
            ["property", properties],
            ["virtual-method", virtualMethods],
        ] as const) {
            for (const member of getChildren(node, tag)) {
                const name = attr(member, "name");
                if (name !== undefined)
                    members.push({
                        owner,
                        name,
                        node: member,
                        introspectable: introspectable && attr(member, "introspectable") !== "0",
                    });
            }
        }
        for (const tag of ownerTags) {
            for (const child of getChildren(node, tag)) {
                visit(child, attr(child, "name") ?? owner, introspectable);
            }
        }
    };
    visit(namespace, namespaceName, true);
    return { callables, signals, properties, virtualMethods };
};

const referencedSymbols = (source: string): Set<string> => {
    const symbols = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (ts.isStringLiteral(node)) {
            symbols.add(node.text);
        }
        ts.forEachChild(node, visit);
    };
    visit(ts.createSourceFile("bindings.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS));
    return symbols;
};

const generatedSignals = (source: string): Set<string> => {
    const signals = new Set<string>();
    const ast = ts.createSourceFile("bindings.d.ts", source, ts.ScriptTarget.Latest, true);
    for (const statement of ast.statements) {
        if (!ts.isInterfaceDeclaration(statement) || !statement.name.text.endsWith("Signals")) {
            continue;
        }
        const owner = statement.name.text.slice(0, -"Signals".length);
        for (const member of statement.members) {
            if (ts.isPropertySignature(member) && ts.isStringLiteral(member.name)) {
                signals.add(`${owner}::${member.name.text}`);
            }
        }
    }
    return signals;
};

const declarationMembers = (source: string): Set<string> => {
    const members = new Set<string>();
    const ast = ts.createSourceFile("bindings.d.ts", source, ts.ScriptTarget.Latest, true);
    const addMembers = (owner: string, declarations: readonly (ts.TypeElement | ts.ClassElement)[]): void => {
        for (const member of declarations) {
            const name = member.name;
            if (name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name)))
                members.add(`${owner}::${name.text}`);
        }
    };
    for (const statement of ast.statements) {
        if (
            (ts.isInterfaceDeclaration(statement) || ts.isClassDeclaration(statement)) &&
            statement.name !== undefined
        ) {
            addMembers(statement.name.text.replace(/^_/, ""), statement.members);
        }
        if (ts.isTypeAliasDeclaration(statement)) {
            const visit = (node: ts.Node): void => {
                if (ts.isTypeLiteralNode(node)) addMembers(statement.name.text, node.members);
                ts.forEachChild(node, visit);
            };
            visit(statement.type);
        }
    }
    return members;
};

const objectProperty = (object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined => {
    const property = object.properties.find(
        (property) =>
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
            property.name.text === name,
    );
    return property !== undefined && ts.isPropertyAssignment(property) ? property.initializer : undefined;
};

const generatedVirtualMethods = (source: string): Map<string, string> => {
    const methods = new Map<string, string>();
    const ast = ts.createSourceFile("bindings.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
            const owner = node.arguments[0];
            const argument = node.arguments[node.expression.text === "registerInterface" ? 3 : 2];
            if (
                (node.expression.text === "registerWrapperClass" || node.expression.text === "registerInterface") &&
                owner !== undefined &&
                ts.isIdentifier(owner) &&
                argument !== undefined &&
                ts.isObjectLiteralExpression(argument)
            ) {
                const slots =
                    node.expression.text === "registerInterface" ? objectProperty(argument, "vfuncs") : argument;
                if (slots !== undefined && ts.isObjectLiteralExpression(slots)) {
                    for (const slot of slots.properties) {
                        if (
                            !ts.isPropertyAssignment(slot) ||
                            !ts.isIdentifier(slot.name) ||
                            !ts.isObjectLiteralExpression(slot.initializer)
                        )
                            continue;
                        const name = objectProperty(slot.initializer, "vfuncName");
                        if (name !== undefined && ts.isStringLiteral(name))
                            methods.set(`${owner.text.replace(/^_/, "")}::${name.text}`, slot.name.text);
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(ast);
    return methods;
};

const propertyMissingDirections = (property: Member, members: Set<string>): PropertyOmission["missing"] => {
    const name = toCamelIdentifier(property.name);
    const missing: PropertyOmission["missing"] = [];
    if (attr(property.node, "readable") !== "0" && !members.has(`${property.owner}Properties::${name}`))
        missing.push("read");
    if (attr(property.node, "writable") === "1") {
        const constructOnly = attr(property.node, "construct-only") === "1";
        if (!members.has(`${property.owner}${constructOnly ? "ConstructorProps" : "WritableProperties"}::${name}`))
            missing.push(constructOnly ? "construct" : "write");
    }
    return missing;
};

const auditNamespace = (workspaceRoot: string, namespace: Namespace): NativeFixtureOmissions => {
    const nativeTests = join(workspaceRoot, "build/native-tests");
    const gir = parseGirFile(join(nativeTests, "gi-tests/build", `${namespace}-1.0.gir`));
    const rawNamespace = getChild(getChild(gir, "repository"), "namespace");
    if (rawNamespace === undefined) {
        throw new Error(`Missing GIR namespace: ${namespace}`);
    }
    const module = namespace.toLowerCase();
    const generated = join(nativeTests, "node_modules/.gtkx/gi", module, module);
    const implementation = readFileSync(`${generated}.js`, "utf8");
    const declarationsSource = readFileSync(`${generated}.d.ts`, "utf8");
    const references = referencedSymbols(implementation);
    const emittedSignals = generatedSignals(declarationsSource);
    const members = declarationMembers(declarationsSource);
    const emittedVirtualMethods = generatedVirtualMethods(implementation);
    const exports = new Set(
        execFileSync("nm", ["-D", "--defined-only", join(nativeTests, "gi-tests/build", `lib${module}.so`)], {
            encoding: "utf8",
        })
            .trim()
            .split("\n")
            .map((line) => line.trim().split(/\s+/).at(-1)),
    );
    const declarations = rawDeclarations(rawNamespace, namespace);
    const bySymbol = new Map<string, Callable>();
    for (const callable of declarations.callables) {
        const existing = bySymbol.get(callable.symbol);
        const rank = (entry: Callable): number =>
            Number(entry.introspectable) * 2 + Number(attr(entry.node, "moved-to") === undefined);
        if (existing === undefined || rank(callable) > rank(existing)) {
            bySymbol.set(callable.symbol, callable);
        }
    }
    const callables = [...bySymbol.values()].filter((callable) => callable.introspectable);
    const omittedCallables = callables
        .filter((callable) => !references.has(callable.symbol))
        .map((callable) => ({
            symbol: callable.symbol,
            owner: callable.owner,
            name: callable.name,
        }))
        .sort((left, right) => left.symbol.localeCompare(right.symbol));
    const signals = declarations.signals.filter((signal) => signal.introspectable);
    const omittedSignals = signals
        .filter((signal) => !emittedSignals.has(`${signal.owner}::${signal.name}`))
        .map((signal) => ({ owner: signal.owner, name: signal.name }))
        .sort((left, right) => `${left.owner}::${left.name}`.localeCompare(`${right.owner}::${right.name}`));
    const properties = declarations.properties.filter((property) => property.introspectable);
    const omittedProperties = properties.flatMap((property) => {
        const missing = propertyMissingDirections(property, members);
        return missing.length === 0 ? [] : [{ owner: property.owner, name: property.name, missing }];
    });
    const virtualMethods = declarations.virtualMethods.filter((method) => method.introspectable);
    const lifecycleNames = new Set(["dispose", "finalize", "get_property", "set_property"]);
    const omittedVirtualMethods = virtualMethods
        .filter((method) => {
            const member = emittedVirtualMethods.get(`${method.owner}::${method.name}`);
            return (
                member === undefined || (!lifecycleNames.has(method.name) && !members.has(`${method.owner}::${member}`))
            );
        })
        .map((method) => ({ owner: method.owner, name: method.name }));
    return {
        namespace,
        callableCount: callables.length,
        generatedCallableCount: callables.length - omittedCallables.length,
        omittedCallables,
        scannerExcludedCallables: [...bySymbol.values()]
            .filter((callable) => !callable.introspectable)
            .map((callable) => callable.symbol)
            .sort(),
        missingNativeSymbols: callables
            .filter((callable) => !exports.has(callable.symbol))
            .map((callable) => callable.symbol)
            .sort(),
        signalCount: signals.length,
        generatedSignalCount: signals.length - omittedSignals.length,
        omittedSignals,
        scannerExcludedSignals: declarations.signals
            .filter((signal) => !signal.introspectable)
            .map((signal) => `${signal.owner}::${signal.name}`)
            .sort(),
        propertyCount: properties.length,
        generatedPropertyCount: properties.length - omittedProperties.length,
        omittedProperties,
        scannerExcludedProperties: declarations.properties
            .filter((property) => !property.introspectable)
            .map((property) => `${property.owner}::${property.name}`)
            .sort(),
        virtualMethodCount: virtualMethods.length,
        generatedVirtualMethodCount: virtualMethods.length - omittedVirtualMethods.length,
        omittedVirtualMethods,
        scannerExcludedVirtualMethods: declarations.virtualMethods
            .filter((method) => !method.introspectable)
            .map((method) => `${method.owner}::${method.name}`)
            .sort(),
        lifecycleVirtualMethods: virtualMethods
            .filter((method) => lifecycleNames.has(method.name))
            .map((method) => `${method.owner}::${method.name}`)
            .sort(),
    };
};

const auditNativeFixtureOmissions = (workspaceRoot: string): NativeFixtureOmissions[] =>
    namespaces.map((namespace) => auditNamespace(workspaceRoot, namespace));

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    console.info(JSON.stringify(auditNativeFixtureOmissions(join(import.meta.dirname, "../../../..")), null, 4));
}

export { auditNativeFixtureOmissions };
