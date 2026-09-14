import { join } from "node:path";
import ts from "typescript";
import { propsDependencies, type PropsDependencies } from "./props-dependencies.js";
import { VIRTUAL_GI_ROOT } from "./props-modules.js";
import { createPropsProgram, type PropsExport, type PropsProgramOptions } from "./props-program.js";

type HandwrittenProp = {
    name: string;
    type: string;
    doc: string;
};

type PropsCatalog = {
    byType: Map<string, HandwrittenProp[]>;
    dependencies: PropsDependencies;
};

type ExportContext = {
    checker: ts.TypeChecker;
    declaration: ts.Node;
    type: ts.Type;
};

const WHITESPACE_RUN = /\s+/g;
const TYPE_FORMAT = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

const exportContext = (program: ts.Program, entry: PropsExport): ExportContext => {
    const source = program.getSourceFile(entry.fileName);
    const checker = program.getTypeChecker();
    const moduleSymbol = source === undefined ? undefined : checker.getSymbolAtLocation(source);
    const exported = moduleSymbol === undefined
        ? undefined
        : checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === entry.name);

    if (exported === undefined || source === undefined) {
        throw new Error(`${entry.fileName} exports no type named ${entry.name}`);
    }

    const symbol = (exported.flags & ts.SymbolFlags.Alias) === 0 ? exported : checker.getAliasedSymbol(exported);

    if ((symbol.flags & ts.SymbolFlags.Type) === 0) {
        throw new Error(`${entry.fileName} does not export ${entry.name} as a type`);
    }

    return {
        checker,
        type: checker.getDeclaredTypeOfSymbol(symbol),
        declaration: symbol.declarations?.[0] ?? source,
    };
};

const isSymbolProperty = (checker: ts.TypeChecker, property: ts.Symbol): boolean =>
    property.declarations?.some((declaration) => {
        const name = ts.getNameOfDeclaration(declaration);

        return name !== undefined && ts.isComputedPropertyName(name) &&
            (checker.getTypeAtLocation(name.expression).flags & ts.TypeFlags.ESSymbolLike) !== 0;
    }) === true;

const formatType = (context: ExportContext, type: ts.Type): string =>
    context.checker.typeToString(type, context.declaration, TYPE_FORMAT);

const formatDoc = (doc: string): string => doc.replaceAll(WHITESPACE_RUN, " ").trim();

const indexDoc = (declaration: ts.IndexSignatureDeclaration | undefined): string => {
    if (declaration === undefined) {
        return "";
    }

    const comments = ts.getJSDocCommentsAndTags(declaration)
        .map((node) => ts.isJSDoc(node) ? ts.getTextOfJSDocComment(node.comment) : undefined);

    return formatDoc(comments.filter((text) => text !== undefined).join(" "));
};

const declaredProps = (context: ExportContext): HandwrittenProp[] => {
    const { checker, type, declaration } = context;
    const properties = checker.getPropertiesOfType(type)
        .filter((property) => !isSymbolProperty(checker, property))
        .map((property) => ({
            name: property.name,
            type: formatType(context, checker.getTypeOfSymbolAtLocation(property, declaration)),
            doc: formatDoc(ts.displayPartsToString(property.getDocumentationComment(checker))),
        }));
    const indices = checker.getIndexInfosOfType(type)
        .filter((info) => (info.keyType.flags & ts.TypeFlags.ESSymbolLike) === 0)
        .map((info) => ({
            name: formatType(context, info.keyType).replaceAll("`", ""),
            type: formatType(context, info.type),
            doc: indexDoc(info.declaration),
        }));

    return [...properties, ...indices];
};

type UnionProp = {
    name: string;
    doc: string;
    keyType?: ts.TypeNode | undefined;
};

type UnionExport = {
    entry: PropsExport;
    props: UnionProp[];
};

const unionProps = (context: ExportContext, variants: readonly ts.Type[]): UnionProp[] => {
    const { checker } = context;
    const properties = Map.groupBy(
        variants.flatMap((variant) => checker.getPropertiesOfType(variant))
            .filter((property) => !isSymbolProperty(checker, property)),
        (property) => property.name,
    );
    const indices = Map.groupBy(
        variants.flatMap((variant) => checker.getIndexInfosOfType(variant))
            .filter((info) => (info.keyType.flags & ts.TypeFlags.ESSymbolLike) === 0),
        (info) => formatType(context, info.keyType),
    );

    return [
        ...[...properties].map(([name, members]) => ({
            name,
            doc: formatDoc([...new Set(members.map((property) =>
                ts.displayPartsToString(property.getDocumentationComment(checker))))].join(" ")),
        })),
        ...[...indices].map(([name, members]) => {
            const [first] = members;
            const keyType = first === undefined
                ? undefined
                : checker.typeToTypeNode(
                        first.keyType,
                        context.declaration,
                        ts.NodeBuilderFlags.NoTruncation,
                    );

            if (keyType === undefined) {
                throw new Error("Cannot represent a configured element prop index");
            }

            return {
                name: name.replaceAll("`", ""),
                doc: [...new Set(members.map((info) => indexDoc(info.declaration)))].filter(Boolean).join(" "),
                keyType,
            };
        }),
    ];
};

const propsProbe = (entries: UnionExport[]): string => {
    const statements = entries.flatMap(({ entry, props }) => props.map((prop) => {
        const name = prop.keyType === undefined
            ? ts.factory.createStringLiteral(prop.name)
            : ts.factory.createComputedPropertyName(ts.factory.createAsExpression(
                    ts.factory.createIdentifier("undefined"),
                    prop.keyType,
                ));
        const object = ts.factory.createObjectLiteralExpression([
            ts.factory.createPropertyAssignment(name, ts.factory.createIdentifier("undefined")),
        ]);
        const type = ts.factory.createImportTypeNode(
            ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(entry.fileName)),
            undefined,
            ts.factory.createIdentifier(entry.name),
        );

        return ts.factory.createExpressionStatement(ts.factory.createAsExpression(object, type));
    }));
    const source = ts.factory.createSourceFile(
        statements,
        ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
        ts.NodeFlags.None,
    );

    return ts.createPrinter().printFile(source);
};

const contextualProps = (
    program: ts.Program,
    fileName: string,
    entries: UnionExport[],
): [string, HandwrittenProp[]][] => {
    const source = program.getSourceFile(fileName);

    if (source === undefined) {
        throw new Error("Cannot load configured element prop context");
    }

    const values: ts.Expression[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isPropertyAssignment(node)) {
            values.push(node.initializer);
        }

        ts.forEachChild(node, visit);
    };
    visit(source);
    let index = 0;

    return entries.map(({ entry, props }) => {
        const context = exportContext(program, entry);

        return [entry.glibName, props.map((prop) => {
            const initializer = values[index++];
            const type = initializer === undefined ? undefined : context.checker.getContextualType(initializer);

            if (type === undefined) {
                throw new Error("Cannot resolve a configured element prop context");
            }

            return { name: prop.name, type: formatType(context, type), doc: prop.doc };
        })];
    });
};

const resolveUnionProps = (
    entries: UnionExport[],
    withSource: (fileName: string, source: string) => ts.Program,
): [string, HandwrittenProp[]][] => {
    if (entries.length === 0) {
        return [];
    }

    const fileName = join(VIRTUAL_GI_ROOT, "props.ts");

    return contextualProps(withSource(fileName, propsProbe(entries)), fileName, entries);
};

const createPropsCatalog = (options: PropsProgramOptions): PropsCatalog => {
    if (Object.keys(options.props).length === 0) {
        return { byType: new Map(), dependencies: propsDependencies(new Map(), []) };
    }

    const { program, exports, dependencies, withSource } = createPropsProgram(options);
    const unions: UnionExport[] = [];
    const byType: Map<string, HandwrittenProp[]> = new Map();

    for (const entry of exports) {
        const context = exportContext(program, entry);

        if (context.type.isUnion()) {
            unions.push({ entry, props: unionProps(context, context.type.types) });
        } else {
            byType.set(entry.glibName, declaredProps(context));
        }
    }

    return { byType: new Map([...byType, ...resolveUnionProps(unions, withSource)]), dependencies };
};

export { createPropsCatalog, type HandwrittenProp, type PropsCatalog };
