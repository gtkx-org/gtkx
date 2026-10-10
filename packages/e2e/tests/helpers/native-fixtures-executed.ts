import { globSync, readFileSync, writeFileSync } from "node:fs";
import type { Profiler } from "node:inspector";
import { join } from "node:path";
import ts from "typescript";
import { nativeCoverage } from "../native/paths.js";

type Surface = { owner: string; name: string; kind: string; isStatic: boolean };
type ScriptReport = Profiler.ScriptCoverage & { source: string };
const tests = join(import.meta.dirname, "../native");
const readReports = (directory: string) =>
    globSync("**/*.test.ts.json", { cwd: directory }).map((name) => ({
        name: name.replace(/\.json$/, ""),
        scripts: JSON.parse(readFileSync(join(directory, name), "utf8")) as ScriptReport[],
    }));

export const keyFor = (surface: Surface): string =>
    `${surface.owner}.${surface.kind}:${surface.isStatic ? "static:" : ""}${surface.name}`;
const nameOf = (node: ts.Node & { name?: ts.DeclarationName }): string | undefined => {
    const name = node.name;
    return name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
};
const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
    ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) === true;
const kindOf = (node: ts.Node): string =>
    ts.isGetAccessorDeclaration(node)
        ? "get"
        : ts.isSetAccessorDeclaration(node)
          ? "set"
          : ts.isConstructorDeclaration(node)
            ? "constructor"
            : "method";
const classOwner = (node: ts.ClassLikeDeclaration): string | undefined => {
    if (node.name !== undefined) return node.name.text.replace(/^_/, "");
    let parent: ts.Node | undefined = node.parent;
    while (parent !== undefined && !ts.isSourceFile(parent)) {
        if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && parent.name.text.startsWith("make"))
            return parent.name.text.slice(4);
        parent = parent.parent;
    }
    return undefined;
};

const inventoryFor = (namespace: string, reports: ReturnType<typeof readReports>) => {
    const module = namespace.toLowerCase();
    const file = join(tests, "node_modules/@gtkx/gi", module, `${module}.d.ts`);
    const declaration = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const surfaces: Surface[] = [];
    const interfaces = new Set(
        declaration.statements.flatMap((statement) =>
            ts.isVariableStatement(statement)
                ? statement.declarationList.declarations.flatMap((variable) =>
                      ts.isIdentifier(variable.name) &&
                      variable.type !== undefined &&
                      ts.isTypeReferenceNode(variable.type) &&
                      ts.isIdentifier(variable.type.typeName) &&
                      variable.type.typeName.text === "InterfaceClass"
                          ? [variable.name.text]
                          : [],
                  )
                : [],
        ),
    );
    for (const statement of declaration.statements) {
        if (
            ts.isFunctionDeclaration(statement) &&
            statement.name !== undefined &&
            hasModifier(statement, ts.SyntaxKind.ExportKeyword)
        ) {
            surfaces.push({ owner: namespace, name: statement.name.text, kind: "function", isStatic: false });
        }
        if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
            for (const variable of statement.declarationList.declarations) {
                if (
                    ts.isIdentifier(variable.name) &&
                    variable.type !== undefined &&
                    (ts.isFunctionTypeNode(variable.type) ||
                        (variable.name.text.startsWith("make") && interfaces.has(variable.name.text.slice(4))))
                )
                    surfaces.push({ owner: namespace, name: variable.name.text, kind: "function", isStatic: false });
            }
        }
        if (ts.isInterfaceDeclaration(statement) && interfaces.has(statement.name.text)) {
            for (const member of statement.members) {
                const name = nameOf(member);
                if (name === undefined || name.startsWith("__") || ["on", "connect", "emit"].includes(name)) continue;
                if (ts.isMethodSignature(member))
                    surfaces.push({ owner: statement.name.text, name, kind: "method", isStatic: false });
                if (ts.isPropertySignature(member)) {
                    surfaces.push({ owner: statement.name.text, name, kind: "get", isStatic: false });
                    if (!hasModifier(member, ts.SyntaxKind.ReadonlyKeyword))
                        surfaces.push({ owner: statement.name.text, name, kind: "set", isStatic: false });
                }
            }
        }
        if (!ts.isClassDeclaration(statement) || statement.name === undefined) continue;
        const owner = statement.name.text.replace(/^_/, "");
        for (const member of statement.members) {
            if (ts.isConstructorDeclaration(member)) {
                if (!hasModifier(statement, ts.SyntaxKind.AbstractKeyword))
                    surfaces.push({ owner, name: "constructor", kind: "constructor", isStatic: false });
                continue;
            }
            const name = nameOf(member);
            if (name === undefined || name.startsWith("__") || ts.isPropertyDeclaration(member)) continue;
            surfaces.push({
                owner,
                name,
                kind: kindOf(member),
                isStatic: hasModifier(member, ts.SyntaxKind.StaticKeyword),
            });
        }
    }
    const required = new Map(surfaces.map((surface) => [keyFor(surface), surface]));
    const evidence = new Map<string, Set<string>>();
    for (const report of reports) {
        for (const script of report.scripts.filter((script) => script.url.includes(`/${module}/${module}.js`))) {
            const source = ts.createSourceFile(
                script.url,
                script.source,
                ts.ScriptTarget.Latest,
                true,
                ts.ScriptKind.JS,
            );
            const nodes: { node: ts.Node; key: string }[] = [];
            const visit = (node: ts.Node): void => {
                if (ts.isFunctionDeclaration(node) && node.name !== undefined)
                    nodes.push({
                        node,
                        key: keyFor({ owner: namespace, name: node.name.text, kind: "function", isStatic: false }),
                    });
                if (
                    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
                    ts.isVariableDeclaration(node.parent) &&
                    ts.isIdentifier(node.parent.name)
                )
                    nodes.push({
                        node,
                        key: keyFor({
                            owner: namespace,
                            name: node.parent.name.text,
                            kind: "function",
                            isStatic: false,
                        }),
                    });
                if (
                    (ts.isMethodDeclaration(node) ||
                        ts.isGetAccessorDeclaration(node) ||
                        ts.isSetAccessorDeclaration(node) ||
                        ts.isConstructorDeclaration(node)) &&
                    ts.isClassLike(node.parent)
                ) {
                    const owner = classOwner(node.parent);
                    const name = ts.isConstructorDeclaration(node) ? "constructor" : nameOf(node);
                    if (owner !== undefined && name !== undefined)
                        nodes.push({
                            node,
                            key: keyFor({
                                owner,
                                name,
                                kind: kindOf(node),
                                isStatic: hasModifier(node, ts.SyntaxKind.StaticKeyword),
                            }),
                        });
                }
                ts.forEachChild(node, visit);
            };
            visit(source);
            for (const fn of script.functions) {
                const range = fn.ranges[0];
                if (range === undefined || range.count === 0) continue;
                const match = nodes.find(
                    ({ node }) => node.getStart(source) <= range.startOffset && node.end === range.endOffset,
                );
                if (match === undefined || !required.has(match.key)) continue;
                const suites = evidence.get(match.key) ?? new Set();
                suites.add(report.name);
                evidence.set(match.key, suites);
            }
        }
    }
    return {
        generated: required.size,
        executed: evidence.size,
        remaining: [...required].filter(([key]) => !evidence.has(key)).map(([, surface]) => surface),
        evidence: Object.fromEntries(
            [...evidence].sort(([a], [b]) => a.localeCompare(b)).map(([key, suites]) => [key, [...suites].sort()]),
        ),
    };
};

export const collectExecutedCoverage = (directory: string) => {
    const reports = readReports(directory);
    return {
        GIMarshallingTests: inventoryFor("GIMarshallingTests", reports),
        Regress: inventoryFor("Regress", reports),
    };
};

if (import.meta.main) {
    const directory = process.argv[2] ?? nativeCoverage;
    const result = collectExecutedCoverage(directory);
    writeFileSync(join(directory, "inventory.json"), `${JSON.stringify(result, null, 4)}\n`);
    for (const [namespace, entry] of Object.entries(result))
        console.info(`${namespace}: ${entry.executed}/${entry.generated} generated APIs executed`);
}
