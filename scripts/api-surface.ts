import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import ts from "typescript";

type Member = { name: string; kind: string; signature: string };
type Export = { name: string; kind: string; signature: string; source: string; docs: string; members: Member[] };
type AmbientModule = { name: string; exports: Export[] };
type Entry = { specifier: string; file: string };
type Report = { specifier: string; file: string; exports: Export[]; modules: AmbientModule[] };

const ROOT_DIR = join(import.meta.dirname, "..");
const OUTPUT_PATH = join(ROOT_DIR, "docs", "api-surface.md");
const MAX_SIGNATURE = 220;
const MAX_DOCS = 140;

const ENTRYPOINTS = [
    "@gtkx/react",
    "@gtkx/react/config",
    "@gtkx/react/env",
    "@gtkx/runtime",
    "@gtkx/native",
    "@gtkx/config",
    "@gtkx/cli/env",
    "@gtkx/gl",
    "@gtkx/components",
    "@gtkx/components/adw",
    "@gtkx/codegen",
    "@gtkx/testing",
    "@gtkx/vitest",
    "@gtkx/css",
];

const DECLARATION_KINDS: Map<ts.SyntaxKind, string> = new Map([
    [ts.SyntaxKind.ClassDeclaration, "class"],
    [ts.SyntaxKind.ClassExpression, "class"],
    [ts.SyntaxKind.EnumDeclaration, "enum"],
    [ts.SyntaxKind.EnumMember, "enum member"],
    [ts.SyntaxKind.FunctionDeclaration, "function"],
    [ts.SyntaxKind.InterfaceDeclaration, "interface"],
    [ts.SyntaxKind.MethodDeclaration, "method"],
    [ts.SyntaxKind.MethodSignature, "method"],
    [ts.SyntaxKind.ModuleDeclaration, "namespace"],
    [ts.SyntaxKind.PropertyDeclaration, "property"],
    [ts.SyntaxKind.PropertySignature, "property"],
    [ts.SyntaxKind.TypeAliasDeclaration, "type"],
]);

const NON_EXPANDABLE = ts.TypeFlags.Any |
    ts.TypeFlags.Unknown |
    ts.TypeFlags.Never |
    ts.TypeFlags.Union |
    ts.TypeFlags.StringLike |
    ts.TypeFlags.NumberLike |
    ts.TypeFlags.BigIntLike |
    ts.TypeFlags.BooleanLike |
    ts.TypeFlags.ESSymbolLike |
    ts.TypeFlags.VoidLike |
    ts.TypeFlags.Null;

const TYPE_KINDS: Set<string> = new Set(["type", "interface"]);

const PACKAGE_NAMES = [
    "cli",
    "codegen",
    "components",
    "config",
    "css",
    "gl",
    "native",
    "react",
    "runtime",
    "testing",
    "vitest",
];

const SIGNATURE_FLAGS = ts.TypeFormatFlags.NoTruncation |
    ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
    ts.TypeFormatFlags.WriteArrowStyleSignature |
    ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType;

const packageDirectories = readPackageDirectories();
const entrypoints = ENTRYPOINTS.map((specifier) => resolveEntrypoint(specifier));
const program = createProgram(entrypoints.map((entry) => entry.file));
const checker = program.getTypeChecker();
const reports = entrypoints.map((entry) => buildReport(entry));

function readPackageDirectories(): Map<string, string> {
    const directories: Map<string, string> = new Map();

    for (const name of PACKAGE_NAMES) {
        const directory = join(ROOT_DIR, "packages", name);
        const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as { name: string };
        directories.set(manifest.name, directory);
    }

    return directories;
}

function splitSpecifier(specifier: string): { packageName: string; subpath: string } {
    const segments = specifier.split("/");
    const packageName = segments.slice(0, 2).join("/");
    const rest = segments.slice(2).join("/");

    return { packageName, subpath: rest === "" ? "." : `./${rest}` };
}

function entryTarget(entry: unknown): string {
    if (typeof entry === "string") {
        return entry;
    }

    const conditions = entry as Record<string, unknown> | null;
    const target = conditions?.source ?? conditions?.types ?? conditions?.default;

    if (typeof target !== "string") {
        throw new TypeError(`unresolvable exports entry: ${JSON.stringify(entry)}`);
    }

    return target;
}

function resolveEntrypoint(specifier: string): Entry {
    const { packageName, subpath } = splitSpecifier(specifier);
    const directory = packageDirectories.get(packageName);

    if (directory === undefined) {
        throw new Error(`unknown package: ${packageName}`);
    }

    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as {
        exports: Record<string, unknown>;
    };

    const file = join(directory, entryTarget(manifest.exports[subpath]));

    if (!existsSync(file)) {
        throw new Error(`missing entrypoint source for ${specifier}: ${file}. Run \`pnpm codegen\` first.`);
    }

    return { specifier, file };
}

function createProgram(files: string[]): ts.Program {
    const configPath = join(ROOT_DIR, "tsconfig.json");
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile.bind(ts.sys));
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT_DIR, undefined, configPath);

    const options: ts.CompilerOptions = {
        ...parsed.options,
        composite: false,
        declaration: false,
        declarationMap: false,
        incremental: false,
        noEmit: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        skipLibCheck: true,
    };

    const ambient = parsed.fileNames.filter((name) => name.endsWith(".d.ts"));

    return ts.createProgram([...ambient, ...files], options);
}

function primaryDeclaration(symbol: ts.Symbol): ts.Declaration | undefined {
    return symbol.declarations?.[0] ?? symbol.valueDeclaration;
}

function resolveAlias(symbol: ts.Symbol): ts.Symbol {
    return (symbol.flags & ts.SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);
}

function oneLine(text: string): string {
    return text
        .replaceAll(/\/\*[\s\S]*?\*\//g, " ")
        .replaceAll(/\s+/g, " ")
        .replaceAll(/ ?\| ?/g, " | ")
        .trim();
}

function linkLabel(body: string): string {
    const parts = body.split(/[\s|]+/).filter((part) => part !== "");

    return parts.length > 1 ? parts.slice(1).join(" ") : parts[0] ?? "";
}

function stripLinks(text: string): string {
    return text.replaceAll(/\{@link([^}]*)\}/g, (_match, body: string) => linkLabel(body));
}

function truncate(text: string, limit: number): string {
    return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

function typeParametersText(declaration: ts.Declaration | undefined): string {
    const parameters = (declaration as { typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration> } | undefined)
        ?.typeParameters;

    if (parameters === undefined || parameters.length === 0) {
        return "";
    }

    return `<${parameters.map((parameter) => oneLine(parameter.getText())).join(", ")}>`;
}

function variableKind(declaration: ts.VariableDeclaration, type: ts.Type): string {
    if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0) {
        return "function";
    }

    const list = declaration.parent;

    return (list.flags & ts.NodeFlags.Const) === 0 ? "let" : "const";
}

function declarationKind(declaration: ts.Declaration | undefined, type: ts.Type): string {
    if (declaration === undefined) {
        return "unknown";
    }

    if (ts.isVariableDeclaration(declaration)) {
        return variableKind(declaration, type);
    }

    return DECLARATION_KINDS.get(declaration.kind) ?? ts.SyntaxKind[declaration.kind];
}

function heritageText(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration): string {
    return oneLine((declaration.heritageClauses ?? []).map((clause) => clause.getText()).join(" "));
}

function declaredSignature(declaration: ts.Declaration, symbol: ts.Symbol): string {
    if (ts.isTypeAliasDeclaration(declaration)) {
        return oneLine(declaration.type.getText());
    }

    if (ts.isInterfaceDeclaration(declaration) || ts.isClassDeclaration(declaration)) {
        return heritageText(declaration);
    }

    if (ts.isEnumDeclaration(declaration)) {
        return declaration.members.map((member) => oneLine(member.name.getText())).join(" | ");
    }

    return oneLine(checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, declaration), declaration,
        SIGNATURE_FLAGS));
}

function getSignature(declaration: ts.Declaration | undefined, symbol: ts.Symbol, type: ts.Type): string {
    const text = declaration === undefined
        ? oneLine(checker.typeToString(type, undefined, SIGNATURE_FLAGS))
        : declaredSignature(declaration, symbol);

    return truncate(text, MAX_SIGNATURE);
}

function displayPath(fileName: string): string {
    const path = relative(ROOT_DIR, fileName);
    const marker = path.lastIndexOf("node_modules/");

    return marker === -1 ? path : path.slice(marker + "node_modules/".length);
}

function getSource(declaration: ts.Declaration | undefined): string {
    if (declaration === undefined) {
        return "";
    }

    const file = declaration.getSourceFile();
    const { line } = file.getLineAndCharacterOfPosition(declaration.getStart());

    return `${displayPath(file.fileName)}:${String(line + 1)}`;
}

function getDocs(symbol: ts.Symbol): string {
    const parts = symbol.getDocumentationComment(checker);
    const comment = stripLinks(oneLine(ts.displayPartsToString(parts)));
    const stop = comment.search(/\.(\s|$)/);
    const sentence = stop === -1 ? comment : comment.slice(0, stop + 1);

    return truncate(sentence, MAX_DOCS);
}

function memberKind(type: ts.Type): string {
    if (checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length > 0) {
        return "constructor";
    }

    if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0) {
        return "method";
    }

    return "property";
}

function describeMember(member: ts.Symbol): Member {
    const declaration = primaryDeclaration(member);

    const type = declaration === undefined
        ? checker.getTypeOfSymbol(member)
        : checker.getTypeOfSymbolAtLocation(member, declaration);

    return {
        name: `${member.getName()}${typeParametersText(declaration)}`,
        kind: memberKind(type),
        signature: getSignature(declaration, member, type),
    };
}

function memberNodes(declaration: ts.Declaration): ts.NodeArray<ts.TypeElement | ts.ClassElement> | undefined {
    if (ts.isInterfaceDeclaration(declaration)) {
        return declaration.members;
    }

    if (ts.isClassDeclaration(declaration)) {
        return declaration.members;
    }

    if (ts.isTypeAliasDeclaration(declaration) && ts.isTypeLiteralNode(declaration.type)) {
        return declaration.type.members;
    }

    return undefined;
}

function isOwnTypeDeclaration(declaration: ts.Declaration): boolean {
    return ts.isTypeAliasDeclaration(declaration) || ts.isEnumDeclaration(declaration);
}

function sortMembers(members: Member[]): Member[] {
    return members
        .filter((member) => member.name !== "" && !member.name.startsWith("__"))
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

function isPublicMember(node: ts.TypeElement | ts.ClassElement): boolean {
    if (node.name === undefined || ts.isPrivateIdentifier(node.name)) {
        return false;
    }

    return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Private) === 0;
}

function memberSymbol(node: ts.TypeElement | ts.ClassElement): ts.Symbol | undefined {
    return node.name === undefined ? undefined : checker.getSymbolAtLocation(node.name);
}

function nodeMembers(nodes: ts.NodeArray<ts.TypeElement | ts.ClassElement>): Member[] {
    return nodes
        .filter((node) => isPublicMember(node))
        .map((node) => memberSymbol(node))
        .filter((symbol) => symbol !== undefined)
        .map((symbol) => describeMember(symbol));
}

function expandType(type: ts.Type): Member[] {
    if ((type.flags & NON_EXPANDABLE) !== 0 || checker.isArrayType(type) || checker.isTupleType(type)) {
        return [];
    }

    return sortMembers(checker.getPropertiesOfType(type).map((member) => describeMember(member)));
}

function getMembers(declaration: ts.Declaration | undefined, type: ts.Type): Member[] {
    if (declaration === undefined) {
        return expandType(type);
    }

    const nodes = memberNodes(declaration);

    if (nodes !== undefined) {
        return sortMembers(nodeMembers(nodes));
    }

    return isOwnTypeDeclaration(declaration) ? [] : expandType(type);
}

function isTypeOnlySpecifier(declaration: ts.Declaration): boolean {
    if (!ts.isExportSpecifier(declaration)) {
        return false;
    }

    return declaration.isTypeOnly || declaration.parent.parent.isTypeOnly;
}

function getExportKind(exported: ts.Symbol, declaration: ts.Declaration | undefined, type: ts.Type): string {
    const kind = declarationKind(declaration, type);
    const isTypeOnly = (exported.declarations ?? []).some((each) => isTypeOnlySpecifier(each));

    return !isTypeOnly || TYPE_KINDS.has(kind) ? kind : `${kind} (type-only)`;
}

function describeExport(exported: ts.Symbol): Export {
    const symbol = resolveAlias(exported);
    const declaration = primaryDeclaration(symbol);

    const type = declaration === undefined
        ? checker.getTypeOfSymbol(symbol)
        : checker.getTypeOfSymbolAtLocation(symbol, declaration);

    return {
        name: `${exported.getName()}${typeParametersText(declaration)}`,
        kind: getExportKind(exported, declaration, type),
        signature: getSignature(declaration, symbol, type),
        source: getSource(declaration),
        docs: getDocs(symbol),
        members: getMembers(declaration, type),
    };
}

function collectExports(moduleSymbol: ts.Symbol): Export[] {
    return checker.getExportsOfModule(moduleSymbol)
        .map((exported) => describeExport(exported))
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

function isAmbientModule(statement: ts.Statement): statement is ts.ModuleDeclaration {
    return ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name);
}

function describeAmbientModule(statement: ts.ModuleDeclaration): AmbientModule {
    const symbol = checker.getSymbolAtLocation(statement.name);

    return { name: statement.name.getText().slice(1, -1), exports: symbol === undefined ? [] : collectExports(symbol) };
}

function ambientModules(file: ts.SourceFile): AmbientModule[] {
    if (ts.isExternalModule(file)) {
        return [];
    }

    return file.statements
        .filter((statement) => isAmbientModule(statement))
        .map((statement) => describeAmbientModule(statement))
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

function buildReport(entry: Entry): Report {
    const file = program.getSourceFile(entry.file);

    if (file === undefined) {
        throw new Error(`entrypoint not part of the program: ${entry.file}`);
    }

    const symbol = checker.getSymbolAtLocation(file);
    const base = { specifier: entry.specifier, file: relative(ROOT_DIR, entry.file) };

    if (symbol === undefined) {
        return { ...base, exports: [], modules: ambientModules(file) };
    }

    return { ...base, exports: collectExports(symbol), modules: ambientModules(file) };
}

function cell(text: string): string {
    return text.replaceAll("|", String.raw`\|`);
}

function code(text: string): string {
    if (text === "") {
        return "—";
    }

    const fence = text.includes("`") ? "``" : "`";
    const padding = text.startsWith("`") || text.endsWith("`") ? " " : "";

    return cell(`${fence}${padding}${text}${padding}${fence}`);
}

function exportRow(entry: Export): string {
    const columns = [code(entry.name), entry.kind, code(entry.signature), code(entry.source), cell(entry.docs) || "—"];

    return `| ${columns.join(" | ")} |`;
}

function memberRow(member: Member): string {
    return `| ${code(member.name)} | ${member.kind} | ${code(member.signature)} |`;
}

function exportTable(exports: Export[]): string[] {
    if (exports.length === 0) {
        return ["_No exports._"];
    }

    return [
        "| Export | Kind | Signature | Declared in | Docs |",
        "| --- | --- | --- | --- | --- |",
        ...exports.map((entry) => exportRow(entry)),
    ];
}

function memberSection(entry: Export, heading: string): string[] {
    if (entry.members.length === 0) {
        return [];
    }

    return [
        "",
        `${heading} \`${entry.name}\` members`,
        "",
        "| Member | Kind | Signature |",
        "| --- | --- | --- |",
        ...entry.members.map((member) => memberRow(member)),
    ];
}

function moduleSection(module: AmbientModule): string[] {
    return [
        "",
        `### \`${module.name}\``,
        "",
        ...exportTable(module.exports),
        ...module.exports.flatMap((entry) => memberSection(entry, "####")),
    ];
}

function anchor(specifier: string): string {
    return specifier.replaceAll(/[^a-z\d]/g, "");
}

function reportSection(report: Report): string[] {
    return [
        "",
        `## \`${report.specifier}\``,
        "",
        `Entrypoint: \`${report.file}\``,
        "",
        ...exportTable(report.exports),
        ...report.exports.flatMap((entry) => memberSection(entry, "###")),
        ...report.modules.flatMap((module) => moduleSection(module)),
    ];
}

function render(all: Report[]): string {
    const lines = [
        "# Public API surface",
        "",
        "Generated by `scripts/api-surface.ts`. Run `pnpm api-surface` to refresh it.",
        "",
        ...all.map((report) => `- [\`${report.specifier}\`](#${anchor(report.specifier)})`),
        ...all.flatMap((report) => reportSection(report)),
        "",
    ];

    return lines.join("\n");
}

function reportDiagnostics(): void {
    const diagnostics = ts.getPreEmitDiagnostics(program)
        .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);

    if (diagnostics.length === 0) {
        return;
    }

    const host: ts.FormatDiagnosticsHost = {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => ROOT_DIR,
        getNewLine: () => "\n",
    };

    throw new Error(`type errors while reading the API surface:\n${ts.formatDiagnostics(diagnostics, host)}`);
}

reportDiagnostics();
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, render(reports));
console.log(`wrote ${relative(ROOT_DIR, OUTPUT_PATH)}`);
