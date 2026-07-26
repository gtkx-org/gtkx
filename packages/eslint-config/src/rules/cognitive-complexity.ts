import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";

type Options = [{ max: number }];

type MessageIds = "excessiveComplexity";

const isNode = (value: unknown): value is TSESTree.Node =>
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";

const isFunction = (node: TSESTree.Node): node is TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression =>
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression;

const hasEnclosingFunction = (node: TSESTree.Node): boolean => {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (isFunction(current)) return true;
        current = current.parent;
    }

    return false;
};

const nameNodeOf = (node: TSESTree.Node): TSESTree.Node => {
    const parent = node.parent;

    if (parent?.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier) {
        return parent.id;
    }

    if (
        (parent?.type === AST_NODE_TYPES.Property ||
            parent?.type === AST_NODE_TYPES.MethodDefinition ||
            parent?.type === AST_NODE_TYPES.PropertyDefinition) &&
            !parent.computed
    ) {
        return parent.key;
    }

    if ((node.type === AST_NODE_TYPES.FunctionDeclaration || node.type === AST_NODE_TYPES.FunctionExpression) && node.id !== null) {
        return node.id;
    }

    return node;
};

const complexityOf = (fn: TSESTree.Node, visitorKeys: TSESLint.SourceCode.VisitorKeys): number => {
    let total = 0;

    const visitChildren = (node: TSESTree.Node, nesting: number): void => {
        for (const key of visitorKeys[node.type] ?? []) {
            const child: unknown = Reflect.get(node, key);

            if (Array.isArray(child)) {
                for (const item of child) {
                    if (isNode(item)) visit(item, nesting);
                }
            } else if (isNode(child)) {
                visit(child, nesting);
            }
        }
    };

    const visitOperand = (node: TSESTree.Node, operator: string, nesting: number): void => {
        if (node.type === AST_NODE_TYPES.LogicalExpression && node.operator === operator) {
            visitOperand(node.left, operator, nesting);
            visitOperand(node.right, operator, nesting);
            return;
        }

        visit(node, nesting);
    };

    const visitIf = (node: TSESTree.IfStatement, nesting: number): void => {
        total += 1 + nesting;
        visit(node.test, nesting);
        visit(node.consequent, nesting + 1);

        let alternate = node.alternate;

        while (alternate !== null) {
            total += 1;

            if (alternate.type === AST_NODE_TYPES.IfStatement) {
                visit(alternate.test, nesting);
                visit(alternate.consequent, nesting + 1);
                alternate = alternate.alternate;
                continue;
            }

            visit(alternate, nesting + 1);
            alternate = null;
        }
    };

    const visit = (node: TSESTree.Node, nesting: number): void => {
        switch (node.type) {
            case AST_NODE_TYPES.IfStatement: {
                visitIf(node, nesting);
                return;
            }
            case AST_NODE_TYPES.ConditionalExpression: {
                total += 1 + nesting;
                visit(node.test, nesting);
                visit(node.consequent, nesting + 1);
                visit(node.alternate, nesting + 1);
                return;
            }
            case AST_NODE_TYPES.SwitchStatement: {
                total += 1 + nesting;
                visit(node.discriminant, nesting);
                for (const switchCase of node.cases) visit(switchCase, nesting + 1);
                return;
            }
            case AST_NODE_TYPES.ForStatement:
            case AST_NODE_TYPES.ForInStatement:
            case AST_NODE_TYPES.ForOfStatement:
            case AST_NODE_TYPES.WhileStatement:
            case AST_NODE_TYPES.DoWhileStatement: {
                total += 1 + nesting;
                for (const key of visitorKeys[node.type] ?? []) {
                    const child: unknown = Reflect.get(node, key);
                    if (isNode(child)) visit(child, key === "body" ? nesting + 1 : nesting);
                }
                return;
            }
            case AST_NODE_TYPES.CatchClause: {
                total += 1 + nesting;
                if (node.param !== null) visit(node.param, nesting);
                visit(node.body, nesting + 1);
                return;
            }
            case AST_NODE_TYPES.LogicalExpression: {
                total += 1;
                visitOperand(node.left, node.operator, nesting);
                visitOperand(node.right, node.operator, nesting);
                return;
            }
            case AST_NODE_TYPES.BreakStatement:
            case AST_NODE_TYPES.ContinueStatement: {
                if (node.label !== null) total += 1;
                return;
            }
            case AST_NODE_TYPES.ArrowFunctionExpression:
            case AST_NODE_TYPES.FunctionDeclaration:
            case AST_NODE_TYPES.FunctionExpression: {
                for (const parameter of node.params) visit(parameter, nesting);
                visit(node.body, nesting + 1);
                return;
            }
            default: {
                visitChildren(node, nesting);
            }
        }
    };

    visitChildren(fn, 0);

    return total;
};

export const cognitiveComplexity = ESLintUtils.RuleCreator.withoutDocs<Options, MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Disallow functions whose cognitive complexity, summed across every nested closure, exceeds a threshold",
        },
        messages: {
            excessiveComplexity:
                "Cognitive complexity of {{complexity}} (max: {{max}}), counting every nested function. Extract the closures into named top-level functions or split this one up.",
        },
        schema: [
            {
                type: "object",
                properties: {
                    max: { type: "integer", minimum: 0 },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [{ max: 15 }],
    create(context, [{ max }]) {
        const check = (node: TSESTree.Node): void => {
            if (hasEnclosingFunction(node)) return;

            const complexity = complexityOf(node, context.sourceCode.visitorKeys);

            if (complexity <= max) return;

            context.report({
                node: nameNodeOf(node),
                messageId: "excessiveComplexity",
                data: { complexity, max },
            });
        };

        return {
            ArrowFunctionExpression: check,
            FunctionDeclaration: check,
            FunctionExpression: check,
        };
    },
});
