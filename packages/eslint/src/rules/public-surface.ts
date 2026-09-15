import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
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

type SurfaceFiles = {
    entries: string[];
    extras: string[];
};

type SurfaceBuild = {
    missing: Set<string>;
    sources: Map<string, SourceSnapshot>;
    surface: Surface;
    version: number;
};

type SourceProgram = {
    inputs: Map<string, SourceSnapshot>;
    missing: Set<string>;
    program: ts.Program;
};

type SourceSnapshot = {
    modified: bigint;
    size: bigint;
    text: string;
};

type ProgramSurface = {
    baselineVersion: number;
    surface: Surface;
};

type Walker = {
    activeSignatures: Set<ts.SignatureDeclaration>;
    checker: ts.TypeChecker;
    keys: Set<string>;
    program: ts.Program;
    scope: Scope;
    symbols: Set<ts.Symbol>;
    types: Set<ts.Type>;
};

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

const baselineSurfaces: Map<string, SurfaceBuild> = new Map();
const programSurfaces: WeakMap<ts.Program, Map<string, ProgramSurface>> = new WeakMap();

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

const resolveSurfaceFiles = (options: SurfaceOptions): SurfaceFiles => ({
    entries: resolveEntryFiles(options.root, options.entrypoints),
    extras: options.modules.map((path) => resolve(options.root, path)),
});

const createProgram = (root: string, files: string[], overlay?: ts.Program): SourceProgram => {
    const configFile = join(root, "tsconfig.base.json");
    const raw = readFileSync(configFile, "utf8");
    const inputs = new Map([[configFile, sourceSnapshot(configFile, raw)]]);
    const base = JSON.parse(raw) as { compilerOptions: Record<string, unknown> };
    const converted = ts.convertCompilerOptionsFromJson(base.compilerOptions, root);
    const options = { ...converted.options, composite: false, incremental: false, noEmit: true };

    const host = ts.createCompilerHost(options);
    const missing: Set<string> = new Set(
        files.filter((fileName) => overlay?.getSourceFile(fileName) === undefined && !host.fileExists(fileName)),
    );
    const scope = { declared: new Set(files), root };
    const fileExists = host.fileExists.bind(host);
    host.fileExists = (fileName): boolean => {
        const hasSource = overlay?.getSourceFile(fileName) !== undefined || fileExists(fileName);

        if (!hasSource && (isInScope(scope, fileName) || basename(fileName) === "package.json")) {
            missing.add(fileName);
        }

        return hasSource;
    };
    const readFile = host.readFile.bind(host);
    host.readFile = (fileName): string | undefined => {
        const text = overlay?.getSourceFile(fileName)?.text ?? readFile(fileName);

        if (text !== undefined && basename(fileName) === "package.json") {
            inputs.set(fileName, sourceSnapshot(fileName, text));
        }

        return text;
    };

    return { inputs, missing, program: ts.createProgram(files, options, host) };
};

const isRestrictedModifier = (modifier: ts.ModifierLike): boolean =>
    modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword;

const isHiddenMember = (node: ts.Node): boolean => {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const name = (node as { name?: ts.Node }).name;
    const isNamedPrivately = name !== undefined && ts.isPrivateIdentifier(name);

    return isNamedPrivately || (modifiers ?? []).some((modifier) => isRestrictedModifier(modifier));
};

const ownMembers = (node: ts.Node): ts.Node[] => {
    if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node) || ts.isTypeLiteralNode(node)) {
        return [...node.members];
    }

    return [];
};

const markMember = (member: ts.Node, walker: Walker): void => {
    walker.keys.add(getDeclarationKey(member));
    markDeclarationTypeLiterals(member, walker);
    const name = (member as ts.NamedDeclaration).name;

    if (name !== undefined) {
        visitSymbol(walker.checker.getSymbolAtLocation(name), walker);
    }
};

const isFilterUtility = (node: ts.TypeReferenceNode, walker: Walker): boolean => {
    if (!ts.isIdentifier(node.typeName) || (node.typeName.text !== "Exclude" && node.typeName.text !== "Extract")) {
        return false;
    }

    const declarations = walker.checker.getSymbolAtLocation(node.typeName)?.declarations ?? [];

    return declarations.some((declaration) => walker.program.isSourceFileDefaultLibrary(declaration.getSourceFile()));
};

const didVisitConditionalResults = (node: ts.Node, visit: (type: ts.Node) => void): boolean => {
    if (!ts.isConditionalTypeNode(node)) {
        return false;
    }

    visit(node.trueType);
    visit(node.falseType);

    return true;
};

const didVisitFilterSource = (
    node: ts.Node,
    walker: Walker,
    visit: (type: ts.Node) => void,
): boolean => {
    if (!ts.isTypeReferenceNode(node) || !isFilterUtility(node, walker)) {
        return false;
    }

    const source = node.typeArguments?.[0];

    if (source !== undefined) {
        visit(source);
    }

    return true;
};

function markTypeLiterals(node: ts.TypeNode | undefined, walker: Walker): void {
    if (node === undefined) {
        return;
    }

    const visit = (type: ts.Node): void => {
        if (ts.isTypeLiteralNode(type)) {
            markMembers(type, walker);

            return;
        }

        if (didVisitConditionalResults(type, visit)) {
            return;
        }

        if (didVisitFilterSource(type, walker, visit)) {
            return;
        }

        type.forEachChild(visit);
    };

    visit(node);
}

const declarationTypeNodes = (node: ts.Node): (ts.TypeNode | undefined)[] => {
    const declaration = node as {
        heritageClauses?: ts.NodeArray<ts.HeritageClause>;
        parameters?: ts.NodeArray<ts.ParameterDeclaration>;
        type?: ts.TypeNode;
        typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>;
    };
    const parameterTypes = (declaration.parameters ?? []).map((parameter) => parameter.type);
    const typeParameterTypes = (declaration.typeParameters ?? []).flatMap((parameter) => [
        parameter.constraint,
        parameter.default,
    ]);
    const heritageTypes = (declaration.heritageClauses ?? []).flatMap((clause) =>
        clause.types.flatMap((type) => [...(type.typeArguments ?? [])]),
    );

    return [declaration.type, ...parameterTypes, ...typeParameterTypes, ...heritageTypes];
};

const markDeclarationTypeLiterals = (node: ts.Node, walker: Walker): void => {
    for (const type of declarationTypeNodes(node)) {
        markTypeLiterals(type, walker);
    }
};

function markMembers(node: ts.Node, walker: Walker): void {
    for (const member of ownMembers(node)) {
        if (!isHiddenMember(member)) {
            markMember(member, walker);
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

const collectTypeEntityNames = (node: ts.TypeNode, out: ts.EntityName[]): void => {
    const visit = (child: ts.Node): void => {
        const name = getEntityName(child);

        if (name !== undefined) {
            out.push(name);
        }

        child.forEachChild(visit);
    };

    visit(node);
};

const heritageNamesIn = (node: ts.Node): ts.EntityName[] => {
    const declaration = node as { heritageClauses?: ts.NodeArray<ts.HeritageClause> };

    return (declaration.heritageClauses ?? [])
        .flatMap((clause) => [...clause.types])
        .map((type) => getHeritageName(type))
        .filter((name) => name !== undefined);
};

const collectEntityNames = (node: ts.Node, out: ts.EntityName[]): void => {
    const types = declarationTypeNodes(node).filter((type) => type !== undefined);
    const members = ownMembers(node).filter((member) => !isHiddenMember(member));

    for (const type of types) {
        collectTypeEntityNames(type, out);
    }

    out.push(...heritageNamesIn(node));

    for (const member of members) {
        collectEntityNames(member, out);
    }
};

const resolveAlias = (symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol =>
    (symbol.flags & ts.SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);

const walkDeclaration = (node: ts.Node, walker: Walker): void => {
    markMembers(node, walker);
    markDeclarationTypeLiterals(node, walker);
    const names: ts.EntityName[] = [];
    collectEntityNames(node, names);

    for (const name of names) {
        const target = ts.isQualifiedName(name) ? name.right : name;
        visitSymbol(walker.checker.getSymbolAtLocation(target), walker);
    }
};

const readTypeArguments = (type: ts.Type, checker: ts.TypeChecker): ts.Type[] => {
    if ((type.flags & ts.TypeFlags.Object) === 0) {
        return [];
    }

    const objectType = type as ts.ObjectType;
    const isReference = (objectType.objectFlags & ts.ObjectFlags.Reference) !== 0;

    return isReference ? [...checker.getTypeArguments(type as ts.TypeReference)] : [];
};

const relatedTypes = (type: ts.Type, checker: ts.TypeChecker): ts.Type[] => {
    const members = type.isUnionOrIntersection() ? [...type.types] : [];

    return [...(type.aliasTypeArguments ?? []), ...readTypeArguments(type, checker), ...members];
};

const followSignature = (signature: ts.Signature, walker: Walker): void => {
    const declaration = signature.getDeclaration();

    if (walker.activeSignatures.has(declaration)) {
        return;
    }

    walker.activeSignatures.add(declaration);

    for (const parameter of signature.parameters) {
        followType(walker.checker.getTypeOfSymbol(parameter), walker);
    }

    followType(walker.checker.getReturnTypeOfSignature(signature), walker);
    walker.activeSignatures.delete(declaration);
};

const followSignatures = (type: ts.Type, walker: Walker): void => {
    const signatures = [ts.SignatureKind.Call, ts.SignatureKind.Construct].flatMap((kind) =>
        walker.checker.getSignaturesOfType(type, kind),
    );

    for (const signature of signatures) {
        followSignature(signature, walker);
    }
};

const hasOwnDeclarations = (symbol: ts.Symbol | undefined, scope: Scope): boolean => {
    const declarations = symbol?.declarations ?? [];

    return declarations.some((node) => isOwnSource(scope, node.getSourceFile()));
};

const followInferredMembers = (type: ts.Type, walker: Walker): void => {
    const declarations = type.getSymbol()?.declarations ?? [];
    const hasInferredMembers = declarations.some((node) =>
        isOwnSource(walker.scope, node.getSourceFile()) &&
        (ts.isObjectLiteralExpression(node) || ts.isClassExpression(node)),
    );

    if (!hasInferredMembers) {
        return;
    }

    for (const member of walker.checker.getPropertiesOfType(type)) {
        if ((member.declarations ?? []).every((node) => !isHiddenMember(node))) {
            visitSymbol(member, walker);
        }
    }
};

function followType(type: ts.Type | undefined, walker: Walker): void {
    if (type === undefined || walker.types.has(type)) {
        return;
    }

    walker.types.add(type);
    visitSymbol(type.aliasSymbol, walker);

    if (hasOwnDeclarations(type.symbol, walker.scope)) {
        visitSymbol(type.symbol, walker);
    }

    followInferredMembers(type, walker);

    for (const related of relatedTypes(type, walker.checker)) {
        followType(related, walker);
    }

    followSignatures(type, walker);
}

const visitDeclarations = (symbol: ts.Symbol, walker: Walker): void => {
    const declarations = symbol.declarations ?? [];

    for (const node of declarations) {
        const key = getDeclarationKey(node);

        if (isOwnSource(walker.scope, node.getSourceFile()) && !walker.keys.has(key)) {
            walker.keys.add(key);
            walkDeclaration(node, walker);
        }
    }
};

const followSymbolType = (symbol: ts.Symbol, walker: Walker): void => {
    followType(walker.checker.getTypeOfSymbol(symbol), walker);
};

function visitSymbol(symbol: ts.Symbol | undefined, walker: Walker): void {
    if (symbol === undefined) {
        return;
    }

    const resolved = resolveAlias(symbol, walker.checker);

    if (walker.symbols.has(resolved) || !hasOwnDeclarations(resolved, walker.scope)) {
        return;
    }

    walker.symbols.add(resolved);
    visitDeclarations(resolved, walker);
    followSymbolType(resolved, walker);
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
        visitSymbol(entry, walker);
    }
};

const markEntry = (file: ts.SourceFile | undefined, walker: Walker): void => {
    if (file?.isDeclarationFile === true) {
        markWholeModule(file, walker);

        return;
    }

    walkModuleExports(file, walker);
};

const buildSurface = (options: SurfaceOptions, files: SurfaceFiles, program: ts.Program): Surface => {
    const { entries, extras } = files;
    const declared = new Set([...entries, ...extras]);
    const scope: Scope = { declared, root: options.root };
    const walker: Walker = {
        activeSignatures: new Set(),
        checker: program.getTypeChecker(),
        keys: new Set(),
        program,
        scope,
        symbols: new Set(),
        types: new Set(),
    };

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

const surfaceKey = (options: SurfaceOptions, files: SurfaceFiles): string => JSON.stringify([options, files]);

const hasMatchingSource = (file: ts.SourceFile, baseline: SurfaceBuild): boolean => {
    const original = baseline.sources.get(file.fileName);

    return original === undefined ? !baseline.missing.has(file.fileName) : original.text === file.text;
};

const hasSameSources = (current: ts.Program, baseline: SurfaceBuild): boolean =>
    current
        .getSourceFiles()
        .filter((file) => isInScope(baseline.surface.scope, file.fileName))
        .every((file) => hasMatchingSource(file, baseline));

const sourceSnapshot = (fileName: string, text: string): SourceSnapshot => {
    const status = statSync(fileName, { bigint: true });

    return { modified: status.mtimeNs, size: status.size, text };
};

const snapshotSources = (program: ts.Program, surface: Surface): Map<string, SourceSnapshot> =>
    new Map(
        program
            .getSourceFiles()
            .filter((file) => isInScope(surface.scope, file.fileName))
            .map((file) => [file.fileName, sourceSnapshot(file.fileName, file.text)]),
    );

const hasSameDiskSources = (baseline: SurfaceBuild): boolean =>
    [...baseline.missing].every((fileName) => !existsSync(fileName)) &&
    [...baseline.sources].every(([fileName, snapshot]) => {
        const current = statSync(fileName, { bigint: true, throwIfNoEntry: false });

        return current?.mtimeNs === snapshot.modified && current.size === snapshot.size;
    });

const baselineSurface = (options: SurfaceOptions, files: SurfaceFiles, key: string): SurfaceBuild => {
    const cached = baselineSurfaces.get(key);

    if (cached !== undefined && hasSameDiskSources(cached)) {
        return cached;
    }

    const { inputs, missing, program } = createProgram(options.root, [...files.entries, ...files.extras]);
    const surface = buildSurface(options, files, program);
    const sources = snapshotSources(program, surface);

    for (const [fileName, input] of inputs) {
        sources.set(fileName, input);
    }

    const built = {
        missing,
        sources,
        surface,
        version: (cached?.version ?? 0) + 1,
    };
    baselineSurfaces.set(key, built);

    return built;
};

const buildForProgram = (
    options: SurfaceOptions,
    files: SurfaceFiles,
    program: ts.Program,
    baseline: SurfaceBuild,
): Surface => {
    if (hasSameSources(program, baseline)) {
        return baseline.surface;
    }

    const overlay = createProgram(options.root, [...files.entries, ...files.extras], program);

    return buildSurface(options, files, overlay.program);
};

const publicSurfaceFor = (options: SurfaceOptions, program: ts.Program): Surface => {
    const files = resolveSurfaceFiles(options);
    const key = surfaceKey(options, files);
    const baseline = baselineSurface(options, files, key);
    const cachedSurfaces = programSurfaces.get(program) ?? new Map<string, ProgramSurface>();
    const cached = cachedSurfaces.get(key);

    if (cached?.baselineVersion === baseline.version) {
        return cached.surface;
    }

    const surface = buildForProgram(options, files, program, baseline);
    cachedSurfaces.set(key, { baselineVersion: baseline.version, surface });
    programSurfaces.set(program, cachedSurfaces);

    return surface;
};

const isGovernedFile = (surface: Surface, fileName: string): boolean => isInScope(surface.scope, fileName);

export { getDeclarationKey, isGovernedFile, publicSurfaceFor, type Surface, type SurfaceOptions };
