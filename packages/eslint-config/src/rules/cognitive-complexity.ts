import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";

type Options = [{ max: number }];
type MessageIds = "excessiveComplexity";
type VisitorKeys = TSESLint.SourceCode.VisitorKeys;
type KeyedParent = TSESTree.Property | TSESTree.MethodDefinition | TSESTree.PropertyDefinition;

type BranchingNode =
    | TSESTree.ArrowFunctionExpression |
    TSESTree.BreakStatement |
    TSESTree.CatchClause |
    TSESTree.ConditionalExpression |
    TSESTree.ContinueStatement |
    TSESTree.DoWhileStatement |
    TSESTree.ForInStatement |
    TSESTree.ForOfStatement |
    TSESTree.ForStatement |
    TSESTree.FunctionDeclaration |
    TSESTree.FunctionExpression |
    TSESTree.IfStatement |
    TSESTree.LogicalExpression |
    TSESTree.SwitchStatement |
    TSESTree.WhileStatement;

const BRANCHING_TYPES: Set<string> = new Set([
    AST_NODE_TYPES.ArrowFunctionExpression,
    AST_NODE_TYPES.BreakStatement,
    AST_NODE_TYPES.CatchClause,
    AST_NODE_TYPES.ConditionalExpression,
    AST_NODE_TYPES.ContinueStatement,
    AST_NODE_TYPES.DoWhileStatement,
    AST_NODE_TYPES.ForInStatement,
    AST_NODE_TYPES.ForOfStatement,
    AST_NODE_TYPES.ForStatement,
    AST_NODE_TYPES.FunctionDeclaration,
    AST_NODE_TYPES.FunctionExpression,
    AST_NODE_TYPES.IfStatement,
    AST_NODE_TYPES.LogicalExpression,
    AST_NODE_TYPES.SwitchStatement,
    AST_NODE_TYPES.WhileStatement,
]);

const FUNCTION_TYPES: Set<string> = new Set([
    AST_NODE_TYPES.ArrowFunctionExpression,
    AST_NODE_TYPES.FunctionDeclaration,
    AST_NODE_TYPES.FunctionExpression,
]);

const KEYED_PARENT_TYPES: Set<string> = new Set([
    AST_NODE_TYPES.Property,
    AST_NODE_TYPES.MethodDefinition,
    AST_NODE_TYPES.PropertyDefinition,
]);

const cognitiveComplexity = ESLintUtils.RuleCreator.withoutDocs<Options, MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Disallow functions whose cognitive complexity, summed across every nested closure, " +
                "exceeds a threshold",
        },
        messages: {
            excessiveComplexity:
                "Cognitive complexity of {{complexity}} (max: {{max}}), counting every nested function. " +
                "Extract the closures into named top-level functions or split this one up.",
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
            if (hasEnclosingFunction(node)) {
                return;
            }

            const complexity = childrenComplexity(node, 0, context.sourceCode.visitorKeys);

            if (complexity <= max) {
                return;
            }

            context.report({
                node: getNameNode(node),
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

const isNode = (value: unknown): value is TSESTree.Node =>
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";

const hasEnclosingFunction = (node: TSESTree.Node): boolean => {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (FUNCTION_TYPES.has(current.type)) {
            return true;
        }

        current = current.parent;
    }

    return false;
};

const isKeyedParent = (node: TSESTree.Node): node is KeyedParent => KEYED_PARENT_TYPES.has(node.type);

const declaratorName = (parent: TSESTree.VariableDeclarator): TSESTree.Node | undefined =>
    parent.id.type === AST_NODE_TYPES.Identifier ? parent.id : undefined;

const parentName = (parent: TSESTree.Node | undefined): TSESTree.Node | undefined => {
    if (parent === undefined) {
        return undefined;
    }

    if (isKeyedParent(parent)) {
        return parent.computed ? undefined : parent.key;
    }

    if (parent.type === AST_NODE_TYPES.VariableDeclarator) {
        return declaratorName(parent);
    }

    return undefined;
};

const ownName = (node: TSESTree.Node): TSESTree.Node | undefined => {
    if (node.type === AST_NODE_TYPES.FunctionDeclaration || node.type === AST_NODE_TYPES.FunctionExpression) {
        return node.id ?? undefined;
    }

    return undefined;
};

const getNameNode = (node: TSESTree.Node): TSESTree.Node => parentName(node.parent) ?? ownName(node) ?? node;

const nodesIn = (value: unknown): TSESTree.Node[] => {
    if (isNode(value)) {
        return [value];
    }

    if (!Array.isArray(value)) {
        return [];
    }

    const nodes: TSESTree.Node[] = [];

    for (const item of value) {
        if (isNode(item)) {
            nodes.push(item);
        }
    }

    return nodes;
};

const getChildNodes = (node: TSESTree.Node, keys: VisitorKeys): TSESTree.Node[] => {
    const nodeKeys = keys[node.type] ?? [];
    const children: TSESTree.Node[] = [];

    for (const key of nodeKeys) {
        children.push(...nodesIn(Reflect.get(node, key)));
    }

    return children;
};

const getSum = <T>(items: T[], score: (item: T) => number): number => {
    let total = 0;

    for (const item of items) {
        total += score(item);
    }

    return total;
};

const childrenComplexity = (node: TSESTree.Node, nesting: number, keys: VisitorKeys): number =>
    getSum(getChildNodes(node, keys), (child) => complexityAt(child, nesting, keys));

const operandComplexity = (node: TSESTree.Node, operator: string, nesting: number, keys: VisitorKeys): number => {
    if (node.type === AST_NODE_TYPES.LogicalExpression && node.operator === operator) {
        return (
            operandComplexity(node.left, operator, nesting, keys) +
            operandComplexity(node.right, operator, nesting, keys)
        );
    }

    return complexityAt(node, nesting, keys);
};

const branchComplexity = (
    test: TSESTree.Node,
    consequent: TSESTree.Node,
    nesting: number,
    keys: VisitorKeys,
): number => 1 + nesting + complexityAt(test, nesting, keys) + complexityAt(consequent, nesting + 1, keys);

const ifComplexity = (node: TSESTree.IfStatement, nesting: number, keys: VisitorKeys): number => {
    let total = branchComplexity(node.test, node.consequent, nesting, keys);
    let alternate = node.alternate;

    while (alternate !== null) {
        total += 1;

        if (alternate.type === AST_NODE_TYPES.IfStatement) {
            total += complexityAt(alternate.test, nesting, keys);
            total += complexityAt(alternate.consequent, nesting + 1, keys);
            alternate = alternate.alternate;
            continue;
        }

        total += complexityAt(alternate, nesting + 1, keys);
        alternate = null;
    }

    return total;
};

const loopChildComplexity = (node: TSESTree.Node, key: string, nesting: number, keys: VisitorKeys): number => {
    const child: unknown = Reflect.get(node, key);

    if (!isNode(child)) {
        return 0;
    }

    return complexityAt(child, key === "body" ? nesting + 1 : nesting, keys);
};

const loopComplexity = (node: TSESTree.Node, nesting: number, keys: VisitorKeys): number => {
    const nodeKeys = keys[node.type] ?? [];
    let total = 1 + nesting;

    for (const key of nodeKeys) {
        total += loopChildComplexity(node, key, nesting, keys);
    }

    return total;
};

const ternaryComplexity = (node: TSESTree.ConditionalExpression, nesting: number, keys: VisitorKeys): number =>
    branchComplexity(node.test, node.consequent, nesting, keys) + complexityAt(node.alternate, nesting + 1, keys);

const logicalComplexity = (node: TSESTree.LogicalExpression, nesting: number, keys: VisitorKeys): number =>
    1 + operandComplexity(node.left, node.operator, nesting, keys) +
    operandComplexity(node.right, node.operator, nesting, keys);

const isBranching = (node: TSESTree.Node): node is BranchingNode => BRANCHING_TYPES.has(node.type);

const branchingComplexity = (node: BranchingNode, nesting: number, keys: VisitorKeys): number => {
    switch (node.type) {
        case AST_NODE_TYPES.IfStatement: {
            return ifComplexity(node, nesting, keys);
        }
        case AST_NODE_TYPES.ConditionalExpression: {
            return ternaryComplexity(node, nesting, keys);
        }
        case AST_NODE_TYPES.SwitchStatement: {
            const cases = getSum(node.cases, (switchCase) => complexityAt(switchCase, nesting + 1, keys));

            return 1 + nesting + complexityAt(node.discriminant, nesting, keys) + cases;
        }
        case AST_NODE_TYPES.ForStatement:
        case AST_NODE_TYPES.ForInStatement:
        case AST_NODE_TYPES.ForOfStatement:
        case AST_NODE_TYPES.WhileStatement:
        case AST_NODE_TYPES.DoWhileStatement: {
            return loopComplexity(node, nesting, keys);
        }
        case AST_NODE_TYPES.CatchClause: {
            const param = node.param === null ? 0 : complexityAt(node.param, nesting, keys);

            return 1 + nesting + param + complexityAt(node.body, nesting + 1, keys);
        }
        case AST_NODE_TYPES.LogicalExpression: {
            return logicalComplexity(node, nesting, keys);
        }
        case AST_NODE_TYPES.BreakStatement:
        case AST_NODE_TYPES.ContinueStatement: {
            return node.label === null ? 0 : 1;
        }
        case AST_NODE_TYPES.ArrowFunctionExpression:
        case AST_NODE_TYPES.FunctionDeclaration:
        case AST_NODE_TYPES.FunctionExpression: {
            const params = getSum(node.params, (parameter) => complexityAt(parameter, nesting, keys));

            return params + complexityAt(node.body, nesting + 1, keys);
        }
    }
};

const complexityAt = (node: TSESTree.Node, nesting: number, keys: VisitorKeys): number =>
    isBranching(node) ? branchingComplexity(node, nesting, keys) : childrenComplexity(node, nesting, keys);

export { cognitiveComplexity };
