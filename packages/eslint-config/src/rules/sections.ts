import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";

type Section = "imports" | "types" | "constants" | "functions" | "classes" | "side effects" | "exports";

const ORDER: Section[] = ["imports", "types", "constants", "functions", "classes", "side effects", "exports"];
const CONTIGUOUS: Set<Section> = new Set<Section>(["imports", "exports"]);

const rankOf = (section: Section): number => ORDER.indexOf(section);

const isFunctionInitializer = (node: TSESTree.Expression | null | undefined): boolean =>
    node?.type === AST_NODE_TYPES.ArrowFunctionExpression || node?.type === AST_NODE_TYPES.FunctionExpression;

const variableSection = (node: TSESTree.VariableDeclaration): Section => {
    if (node.kind !== "const") return "constants";

    return node.declarations.every((declaration) => isFunctionInitializer(declaration.init))
        ? "functions"
        : "constants";
};

const sectionOf = (node: TSESTree.Node): Section | undefined => {
    switch (node.type) {
        case AST_NODE_TYPES.ImportDeclaration: {
            return "imports";
        }
        case AST_NODE_TYPES.TSTypeAliasDeclaration:
        case AST_NODE_TYPES.TSInterfaceDeclaration:
        case AST_NODE_TYPES.TSEnumDeclaration: {
            return "types";
        }
        case AST_NODE_TYPES.VariableDeclaration: {
            return variableSection(node);
        }
        case AST_NODE_TYPES.FunctionDeclaration:
        case AST_NODE_TYPES.TSDeclareFunction: {
            return "functions";
        }
        case AST_NODE_TYPES.ClassDeclaration: {
            return "classes";
        }
        case AST_NODE_TYPES.ExpressionStatement: {
            return "side effects";
        }
        case AST_NODE_TYPES.ExportAllDeclaration: {
            return "exports";
        }
        case AST_NODE_TYPES.ExportNamedDeclaration: {
            return node.declaration === null ? "exports" : sectionOf(node.declaration);
        }
        default: {
            return undefined;
        }
    }
};

export { ORDER, CONTIGUOUS, rankOf, sectionOf, type Section };
