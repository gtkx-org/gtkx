import { readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import ts from "typescript";
import { resolveEntrypoints } from "../api-entrypoints.js";

type SurfaceOptions = {
    root: string;
    entrypoints: string[];
    modules: string[];
};

type Scope = {
    declared: Set<string>;
    root: string;
};

type Surface = {
    keys: Set<string>;
    scope: Scope;
};

type Walker = {
    checker: ts.TypeChecker;
    keys: Set<string>;
    scope: Scope;
    symbols: Set<ts.Symbol>;
};

const MAX_DEPTH = 60;
const MAX_HOPS = 6;
const MAX_MEMBER_DEPTH = 8;

const MEMBER_KINDS: Set<ts.SyntaxKind> = new Set([
    ts.SyntaxKind.CallSignature,
    ts.SyntaxKind.ConstructSignature,
    ts.SyntaxKind.Constructor,
    ts.SyntaxKind.GetAccessor,
    ts.SyntaxKind.IndexSignature,
    ts.SyntaxKind.MethodDeclaration,
    ts.SyntaxKind.MethodSignature,
    ts.SyntaxKind.PropertyDeclaration,
    ts.SyntaxKind.PropertySignature,
    ts.SyntaxKind.SetAccessor,
]);

const DOCUMENTABLE_KINDS: Set<ts.SyntaxKind> = new Set([
    ...MEMBER_KINDS,
    ts.SyntaxKind.ClassDeclaration,
    ts.SyntaxKind.EnumDeclaration,
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.InterfaceDeclaration,
    ts.SyntaxKind.TypeAliasDeclaration,
    ts.SyntaxKind.VariableStatement,
]);

const surfaces: Map<string, Surface> = new Map();

const getDeclarationKey = (node: ts.Node): string =>
    `${node.getSourceFile().fileName}:${String(node.pos)}`;

const isPackageSource = (root: string, fileName: string): boolean =>
    fileName.startsWith(`${root}${sep}packages${sep}`) &&
    fileName.includes(`${sep}src${sep}`) &&
    !fileName.includes(`${sep}node_modules${sep}`) &&
    !fileName.endsWith(".d.ts");

const isInScope = (scope: Scope, fileName: string): boolean =>
    scope.declared.has(fileName) || isPackageSource(scope.root, fileName);

const isOwnSource = (scope: Scope, file: ts.SourceFile): boolean => isInScope(scope, file.fileName);

const resolveEntryFiles = (root: string, entrypoints: string[]): string[] =>
    resolveEntrypoints(root, entrypoints, "source").map((entry) => resolve(entry.dir, entry.path));

const createProgram = (root: string, files: string[]): ts.Program => {
    const raw = readFileSync(join(root, "tsconfig.base.json"), "utf8");
    const base = JSON.parse(raw) as { compilerOptions: Record<string, unknown> };
    const { options } = ts.convertCompilerOptionsFromJson(base.compilerOptions, root);

    return ts.createProgram(files, { ...options, composite: false, incremental: false, noEmit: true });
};

const isRestrictedModifier = (modifier: ts.ModifierLike): boolean =>
    modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword;

const isHiddenMember = (node: ts.Node): boolean => {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const name = (node as { name?: ts.Node }).name;
    const isNamedPrivately = name !== undefined && ts.isPrivateIdentifier(name);

    return isNamedPrivately || (modifiers ?? []).some((modifier) => isRestrictedModifier(modifier));
};

const childTypeNodes = (node: ts.TypeNode): ts.TypeNode[] => {
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
        return [...node.types];
    }

    if (ts.isArrayTypeNode(node)) {
        return [node.elementType];
    }

    return ts.isParenthesizedTypeNode(node) || ts.isFunctionTypeNode(node) ? [node.type] : [];
};

const collectTypeLiterals = (node: ts.TypeNode | undefined, out: ts.TypeLiteralNode[], depth: number): void => {
    if (node === undefined || depth > MAX_MEMBER_DEPTH) {
        return;
    }

    if (ts.isTypeLiteralNode(node)) {
        out.push(node);

        return;
    }

    for (const child of childTypeNodes(node)) {
        collectTypeLiterals(child, out, depth + 1);
    }
};

const literalsIn = (node: ts.TypeNode | undefined): ts.TypeLiteralNode[] => {
    const literals: ts.TypeLiteralNode[] = [];
    collectTypeLiterals(node, literals, 0);

    return literals;
};

const ownMembers = (node: ts.Node): ts.Node[] => {
    if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node) || ts.isTypeLiteralNode(node)) {
        return [...node.members];
    }

    if (!ts.isTypeAliasDeclaration(node)) {
        return [];
    }

    return literalsIn(node.type).flatMap((literal) => [...literal.members]);
};

const markMember = (member: ts.Node, walker: Walker, depth: number): void => {
    walker.keys.add(getDeclarationKey(member));
    const nested = literalsIn((member as { type?: ts.TypeNode }).type);

    for (const literal of nested) {
        markMembers(literal, walker, depth + 1);
    }
};

function markMembers(node: ts.Node, walker: Walker, depth: number): void {
    if (depth > MAX_MEMBER_DEPTH) {
        return;
    }

    for (const member of ownMembers(node)) {
        if (!isHiddenMember(member)) {
            markMember(member, walker, depth);
        }
    }
}

const getReferencedName = (node: ts.Node): ts.EntityName | undefined => {
    if (ts.isTypeReferenceNode(node)) {
        return node.typeName;
    }

    if (ts.isTypeQueryNode(node)) {
        return node.exprName;
    }

    return ts.isImportTypeNode(node) ? node.qualifier : undefined;
};

const getHeritageName = (node: ts.Node): ts.EntityName | undefined =>
    ts.isExpressionWithTypeArguments(node) && ts.isIdentifier(node.expression) ? node.expression : undefined;

const getEntityName = (node: ts.Node): ts.EntityName | undefined =>
    getReferencedName(node) ?? getHeritageName(node);

const collectEntityNames = (node: ts.Node, out: ts.EntityName[]): void => {
    const visit = (child: ts.Node): void => {
        const name = getEntityName(child);

        if (name !== undefined) {
            out.push(name);
        }

        child.forEachChild(visit);
    };

    node.forEachChild(visit);
};

const resolveAlias = (symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol => {
    if ((symbol.flags & ts.SymbolFlags.Alias) === 0) {
        return symbol;
    }

    try {
        return checker.getAliasedSymbol(symbol);
    } catch {
        return symbol;
    }
};

const walkDeclaration = (node: ts.Node, walker: Walker, depth: number): void => {
    markMembers(node, walker, 0);
    const names: ts.EntityName[] = [];
    collectEntityNames(node, names);

    for (const name of names) {
        const target = ts.isQualifiedName(name) ? name.right : name;
        visitSymbol(walker.checker.getSymbolAtLocation(target), walker, depth + 1);
    }
};

const readTypeArguments = (type: ts.Type, checker: ts.TypeChecker): ts.Type[] => {
    const objectFlags = (type as ts.ObjectType).objectFlags;
    const isReference = (type.flags & ts.TypeFlags.Object) !== 0 && (objectFlags & ts.ObjectFlags.Reference) !== 0;

    return isReference ? [...checker.getTypeArguments(type as ts.TypeReference)] : [];
};

const relatedTypes = (type: ts.Type, checker: ts.TypeChecker): ts.Type[] => {
    const members = type.isUnionOrIntersection() ? [...type.types] : [];

    return [...(type.aliasTypeArguments ?? []), ...readTypeArguments(type, checker), ...members];
};

const followSignature = (signature: ts.Signature, walker: Walker, depth: number, hops: number): void => {
    for (const parameter of signature.parameters) {
        followType(walker.checker.getTypeOfSymbol(parameter), walker, depth, hops + 1);
    }

    followType(walker.checker.getReturnTypeOfSignature(signature), walker, depth, hops + 1);
};

const followSignatures = (type: ts.Type, walker: Walker, depth: number, hops: number): void => {
    const signatures = walker.checker.getSignaturesOfType(type, ts.SignatureKind.Call);

    for (const signature of signatures) {
        followSignature(signature, walker, depth, hops);
    }
};

const hasOwnDeclarations = (symbol: ts.Symbol | undefined, scope: Scope): boolean => {
    const declarations = symbol?.declarations ?? [];

    return declarations.some((node) => isOwnSource(scope, node.getSourceFile()));
};

function followType(type: ts.Type | undefined, walker: Walker, depth: number, hops: number): void {
    if (type === undefined || hops > MAX_HOPS || depth > MAX_DEPTH) {
        return;
    }

    visitSymbol(type.aliasSymbol, walker, depth);

    if (hasOwnDeclarations(type.symbol, walker.scope)) {
        visitSymbol(type.symbol, walker, depth);
    }

    for (const related of relatedTypes(type, walker.checker)) {
        followType(related, walker, depth, hops + 1);
    }

    followSignatures(type, walker, depth, hops);
}

const visitDeclarations = (symbol: ts.Symbol, walker: Walker, depth: number): void => {
    const declarations = symbol.declarations ?? [];

    for (const node of declarations) {
        const key = getDeclarationKey(node);

        if (isOwnSource(walker.scope, node.getSourceFile()) && !walker.keys.has(key)) {
            walker.keys.add(key);
            walkDeclaration(node, walker, depth);
        }
    }
};

const followSymbolType = (symbol: ts.Symbol, walker: Walker, depth: number): void => {
    try {
        followType(walker.checker.getTypeOfSymbol(symbol), walker, depth + 1, 0);
    } catch {
        return;
    }
};

function visitSymbol(symbol: ts.Symbol | undefined, walker: Walker, depth: number): void {
    if (symbol === undefined || depth > MAX_DEPTH) {
        return;
    }

    const resolved = resolveAlias(symbol, walker.checker);

    if (walker.symbols.has(resolved) || !hasOwnDeclarations(resolved, walker.scope)) {
        return;
    }

    walker.symbols.add(resolved);
    visitDeclarations(resolved, walker, depth);
    followSymbolType(resolved, walker, depth);
}

const markWholeModule = (file: ts.SourceFile, walker: Walker): void => {
    const visit = (node: ts.Node): void => {
        if (DOCUMENTABLE_KINDS.has(node.kind)) {
            walker.keys.add(getDeclarationKey(node));
        }

        node.forEachChild(visit);
    };

    file.forEachChild(visit);
};

const walkModuleExports = (file: ts.SourceFile | undefined, walker: Walker): void => {
    const symbol = file === undefined ? undefined : walker.checker.getSymbolAtLocation(file);
    const exported = symbol === undefined ? [] : walker.checker.getExportsOfModule(symbol);

    for (const entry of exported) {
        visitSymbol(entry, walker, 0);
    }
};

const markEntry = (file: ts.SourceFile | undefined, walker: Walker): void => {
    if (file?.isDeclarationFile === true) {
        markWholeModule(file, walker);

        return;
    }

    walkModuleExports(file, walker);
};

const buildSurface = (options: SurfaceOptions): Surface => {
    const entries = resolveEntryFiles(options.root, options.entrypoints);
    const extras = options.modules.map((path) => resolve(options.root, path));
    const declared = new Set([...entries, ...extras]);
    const program = createProgram(options.root, [...declared]);
    const scope: Scope = { declared, root: options.root };
    const walker: Walker = { checker: program.getTypeChecker(), keys: new Set(), scope, symbols: new Set() };

    for (const entry of entries) {
        markEntry(program.getSourceFile(entry), walker);
    }

    for (const extra of extras) {
        const file = program.getSourceFile(extra);

        if (file !== undefined) {
            markWholeModule(file, walker);
        }
    }

    return { keys: walker.keys, scope };
};

const publicSurfaceFor = (options: SurfaceOptions): Surface => {
    const key = JSON.stringify(options);
    const cached = surfaces.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const surface = buildSurface(options);
    surfaces.set(key, surface);

    return surface;
};

const isGovernedFile = (surface: Surface, fileName: string): boolean => isInScope(surface.scope, fileName);

export { getDeclarationKey, isGovernedFile, publicSurfaceFor, type Surface, type SurfaceOptions };
