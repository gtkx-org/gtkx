import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type MemberNode =
    | TSESTree.AccessorProperty |
    TSESTree.MethodDefinition |
    TSESTree.PropertyDefinition |
    TSESTree.TSMethodSignature |
    TSESTree.TSPropertySignature;

const memberVisitors = (handler: (node: MemberNode) => void): TSESLint.RuleListener => ({
    AccessorProperty: handler,
    MethodDefinition: handler,
    PropertyDefinition: handler,
    TSMethodSignature: handler,
    TSPropertySignature: handler,
});

export { memberVisitors, type MemberNode };
