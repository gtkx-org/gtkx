import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";

const getIdentifierName = (node: TSESTree.Node | null | undefined): string | undefined =>
    node?.type === AST_NODE_TYPES.Identifier ? node.name : undefined;

export { getIdentifierName };
