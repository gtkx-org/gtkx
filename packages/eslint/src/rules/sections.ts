import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";

type Section = "imports" | "types" | "constants" | "functions" | "classes" | "side effects" | "exports";

const ORDER: Section[] = ["imports", "types", "constants", "functions", "classes", "side effects", "exports"];
const CONTIGUOUS: Set<Section> = new Set<Section>(["imports", "exports"]);

const SECTION_BY_TYPE: Partial<Record<AST_NODE_TYPES, Section>> = {
    [AST_NODE_TYPES.ClassDeclaration]: "classes",
    [AST_NODE_TYPES.ExportAllDeclaration]: "exports",
    [AST_NODE_TYPES.ExpressionStatement]: "side effects",
    [AST_NODE_TYPES.FunctionDeclaration]: "functions",
    [AST_NODE_TYPES.ImportDeclaration]: "imports",
    [AST_NODE_TYPES.TSDeclareFunction]: "functions",
    [AST_NODE_TYPES.TSEnumDeclaration]: "types",
    [AST_NODE_TYPES.TSInterfaceDeclaration]: "types",
    [AST_NODE_TYPES.TSTypeAliasDeclaration]: "types",
};

const rankFor = (section: Section): number => ORDER.indexOf(section);

const isFunctionInitializer = (node: TSESTree.Expression | null | undefined): boolean =>
    node?.type === AST_NODE_TYPES.ArrowFunctionExpression || node?.type === AST_NODE_TYPES.FunctionExpression;

const variableSection = (node: TSESTree.VariableDeclaration): Section => {
    if (node.kind !== "const") {
        return "constants";
    }

    return node.declarations.every((declaration) => isFunctionInitializer(declaration.init))
        ? "functions"
        : "constants";
};

const getSection = (node: TSESTree.Node): Section | undefined => {
    if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        return variableSection(node);
    }

    if (node.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        return node.declaration === null ? "exports" : getSection(node.declaration);
    }

    return SECTION_BY_TYPE[node.type];
};

export { ORDER, CONTIGUOUS, rankFor, getSection, type Section };
