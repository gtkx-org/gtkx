import type { ModuleExport } from "@gtkx/react/config";
import { fileURLToPath } from "node:url";
import ts from "typescript";

type HandwrittenProp = {
    name: string;
    type: string;
    doc: string;
};

type AliasSite = {
    sourceFile: ts.SourceFile;
    declaration: ts.TypeAliasDeclaration;
};

type NamedBinding = ts.ImportSpecifier | ts.ExportSpecifier;

const RESOLUTION_OPTIONS: ts.CompilerOptions = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    customConditions: ["source"],
};

const CONTAINING_FILE = fileURLToPath(import.meta.url);
const WHITESPACE_RUN = /\s+/g;
const propsByRef: Map<string, HandwrittenProp[]> = new Map();

const moduleFileFor = (specifier: string, containingFile: string): string | undefined =>
    ts.resolveModuleName(specifier, containingFile, RESOLUTION_OPTIONS, ts.sys).resolvedModule?.resolvedFileName;

const parseModule = (filePath: string): ts.SourceFile =>
    ts.createSourceFile(filePath, ts.sys.readFile(filePath) ?? "", ts.ScriptTarget.Latest, true);

const specifierText = (node: ts.Expression | undefined): string | undefined =>
    node !== undefined && ts.isStringLiteral(node) ? node.text : undefined;

const boundName = (elements: readonly NamedBinding[], name: string): string | undefined => {
    for (const element of elements) {
        if (element.name.text === name) {
            return (element.propertyName ?? element.name).text;
        }
    }

    return undefined;
};

const findAliasInModule = (specifier: string, sourceFile: ts.SourceFile, name: string): AliasSite | undefined => {
    const filePath = moduleFileFor(specifier, sourceFile.fileName);

    return filePath === undefined ? undefined : findAlias(parseModule(filePath), name);
};

const importedAlias = (
    statement: ts.ImportDeclaration,
    sourceFile: ts.SourceFile,
    name: string,
): AliasSite | undefined => {
    const bindings = statement.importClause?.namedBindings;
    const specifier = specifierText(statement.moduleSpecifier);

    if (specifier === undefined || bindings === undefined || !ts.isNamedImports(bindings)) {
        return undefined;
    }

    const imported = boundName(bindings.elements, name);

    return imported === undefined ? undefined : findAliasInModule(specifier, sourceFile, imported);
};

const exportedAlias = (
    statement: ts.ExportDeclaration,
    sourceFile: ts.SourceFile,
    name: string,
): AliasSite | undefined => {
    const specifier = specifierText(statement.moduleSpecifier);

    if (specifier === undefined) {
        return undefined;
    }

    const clause = statement.exportClause;

    if (clause === undefined) {
        return findAliasInModule(specifier, sourceFile, name);
    }

    const exported = ts.isNamedExports(clause) ? boundName(clause.elements, name) : undefined;

    return exported === undefined ? undefined : findAliasInModule(specifier, sourceFile, exported);
};

const statementAlias = (statement: ts.Statement, sourceFile: ts.SourceFile, name: string): AliasSite | undefined => {
    if (ts.isTypeAliasDeclaration(statement)) {
        return statement.name.text === name ? { sourceFile, declaration: statement } : undefined;
    }

    if (ts.isImportDeclaration(statement)) {
        return importedAlias(statement, sourceFile, name);
    }

    return ts.isExportDeclaration(statement) ? exportedAlias(statement, sourceFile, name) : undefined;
};

const propType = (type: ts.TypeNode, sourceFile: ts.SourceFile): string => {
    const parts: readonly ts.TypeNode[] = ts.isUnionTypeNode(type) ? type.types : [type];

    return parts
        .filter((part) => part.kind !== ts.SyntaxKind.UndefinedKeyword)
        .map((part) => part.getText(sourceFile).replaceAll(WHITESPACE_RUN, " "))
        .join(" | ");
};

const propDoc = (member: ts.TypeElement): string => {
    const comments = ts
        .getJSDocCommentsAndTags(member)
        .map((node) => (ts.isJSDoc(node) ? ts.getTextOfJSDocComment(node.comment) : undefined));

    return comments.filter((text) => text !== undefined).join(" ").replaceAll(WHITESPACE_RUN, " ").trim();
};

const propertyProp = (member: ts.PropertySignature, sourceFile: ts.SourceFile): HandwrittenProp | undefined => {
    const { name, type } = member;

    if (type === undefined || !(ts.isIdentifier(name) || ts.isStringLiteral(name))) {
        return undefined;
    }

    return { name: name.text, type: propType(type, sourceFile), doc: propDoc(member) };
};

const indexProp = (member: ts.IndexSignatureDeclaration, sourceFile: ts.SourceFile): HandwrittenProp | undefined => {
    const keyType = member.parameters[0]?.type;

    if (keyType === undefined) {
        return undefined;
    }

    return {
        name: keyType.getText(sourceFile).replaceAll("`", ""),
        type: propType(member.type, sourceFile),
        doc: propDoc(member),
    };
};

const memberProp = (member: ts.TypeElement, sourceFile: ts.SourceFile): HandwrittenProp | undefined => {
    if (ts.isPropertySignature(member)) {
        return propertyProp(member, sourceFile);
    }

    return ts.isIndexSignatureDeclaration(member) ? indexProp(member, sourceFile) : undefined;
};

const literalProps = (type: ts.TypeLiteralNode, sourceFile: ts.SourceFile): HandwrittenProp[] => {
    const props: HandwrittenProp[] = [];

    for (const member of type.members) {
        const prop = memberProp(member, sourceFile);

        if (prop !== undefined) {
            props.push(prop);
        }
    }

    return props;
};

const referenceProps = (type: ts.TypeReferenceNode, sourceFile: ts.SourceFile): HandwrittenProp[] => {
    if (!ts.isIdentifier(type.typeName)) {
        return [];
    }

    const site = findAlias(sourceFile, type.typeName.text);

    return site === undefined ? [] : typeNodeProps(site.declaration.type, site.sourceFile);
};

const declaredProps = (ref: ModuleExport): HandwrittenProp[] => {
    const filePath = moduleFileFor(ref.module, CONTAINING_FILE);

    if (filePath === undefined) {
        throw new Error(`Cannot resolve ${ref.module}, which declares the ${ref.export} element props`);
    }

    const site = findAlias(parseModule(filePath), ref.export);

    if (site === undefined) {
        throw new Error(`${ref.module} declares no type named ${ref.export}`);
    }

    return typeNodeProps(site.declaration.type, site.sourceFile);
};

const handwrittenPropsFor = (ref: ModuleExport): HandwrittenProp[] => {
    const key = `${ref.module}#${ref.export}`;
    const cached = propsByRef.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const props = declaredProps(ref);
    propsByRef.set(key, props);

    return props;
};

function findAlias(sourceFile: ts.SourceFile, name: string): AliasSite | undefined {
    for (const statement of sourceFile.statements) {
        const site = statementAlias(statement, sourceFile, name);

        if (site !== undefined) {
            return site;
        }
    }

    return undefined;
}

function typeNodeProps(type: ts.TypeNode, sourceFile: ts.SourceFile): HandwrittenProp[] {
    if (ts.isTypeLiteralNode(type)) {
        return literalProps(type, sourceFile);
    }

    if (ts.isIntersectionTypeNode(type)) {
        return type.types.flatMap((part) => typeNodeProps(part, sourceFile));
    }

    return ts.isTypeReferenceNode(type) ? referenceProps(type, sourceFile) : [];
}

export { handwrittenPropsFor, type HandwrittenProp };
