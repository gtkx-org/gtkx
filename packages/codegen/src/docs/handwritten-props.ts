import ts from "typescript";
import { propsDependencies, type PropsDependencies } from "./props-dependencies.js";
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

const createPropsCatalog = (options: PropsProgramOptions): PropsCatalog => {
    if (Object.keys(options.props).length === 0) {
        return { byType: new Map(), dependencies: propsDependencies([], []) };
    }

    const { program, exports, dependencies } = createPropsProgram(options);
    const byType = new Map(exports.map((entry) => [
        entry.glibName,
        declaredProps(exportContext(program, entry)),
    ]));

    return { byType, dependencies };
};

export { createPropsCatalog, type HandwrittenProp, type PropsCatalog };
