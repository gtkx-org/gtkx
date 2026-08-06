import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { getIdentifierName } from "./identifier-name.js";

type MessageIds = "missingPrefix" | "notBoolean" | "negated";
type Context = TSESLint.RuleContext<MessageIds, []>;
type Shape = "boolean" | "other" | "unknown";
type PropertyNode = TSESTree.PropertyDefinition | TSESTree.TSPropertySignature;

const PREFIX = /^(is|are|has|have|can|should|did|will|was|were|requires)[A-Z0-9]/;
const NEGATED = /^(not|no|disable|disabled|skip|skipped|omit|omitted|exclude|excluded|without)[A-Z0-9]/;
const PREFIX_LIST = "is, are, has, have, can, should, did, will, was, were, requires";
const COMPARISONS: Set<string> = new Set(["===", "!==", "==", "!=", "<", ">", "<=", ">=", "in", "instanceof"]);

const booleanName = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description: "Name every boolean with an is/has/can/should prefix, and reserve those prefixes for booleans",
        },
        messages: {
            missingPrefix:
                "`{{name}}` is a boolean but reads as a noun. Prefix it with one of: {{prefixes}}, and keep the " +
                "same spelling at every hop of its call chain.",
            notBoolean:
                "`{{name}}` reads as a boolean but holds {{shape}}. Name it for what it holds, so a reader does " +
                "not take it for a flag.",
            negated:
                "`{{name}}` encodes a negation, so call sites read as double negatives. Name the positive " +
                "question and let the caller write `!`.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const check = (key: TSESTree.Node | null | undefined, node: TSESTree.Node, shape: Shape): void => {
            const name = getIdentifierName(key);

            if (name !== undefined) {
                report(context, node, name, shape);
            }
        };

        const checkProperty = (node: PropertyNode): void => {
            if (node.computed) {
                return;
            }

            check(node.key, node, getAnnotationShape(node.typeAnnotation));
        };

        return {
            PropertyDefinition: checkProperty,
            TSPropertySignature: checkProperty,
            VariableDeclarator: (node): void => {
                check(node.id, node, getDeclaratorShape(node));
            },
        };
    },
});

const isBooleanLiteralNode = (node: TSESTree.TypeNode): boolean =>
    node.type === AST_NODE_TYPES.TSLiteralType &&
    node.literal.type === AST_NODE_TYPES.Literal &&
    typeof node.literal.value === "boolean";

const isBooleanNode = (node: TSESTree.TypeNode): boolean =>
    node.type === AST_NODE_TYPES.TSBooleanKeyword || isBooleanLiteralNode(node);

const isNullishNode = (node: TSESTree.TypeNode): boolean =>
    node.type === AST_NODE_TYPES.TSUndefinedKeyword || node.type === AST_NODE_TYPES.TSNullKeyword;

const getUnionShape = (node: TSESTree.TSUnionType): Shape => {
    const members = node.types.filter((member) => !isNullishNode(member));

    if (members.every((member) => isBooleanNode(member))) {
        return "boolean";
    }

    return members.some((member) => isBooleanNode(member)) ? "unknown" : "other";
};

const getFunctionShape = (node: TSESTree.TSFunctionType): Shape => {
    const returns = getAnnotationShape(node.returnType);

    return returns === "boolean" ? "unknown" : returns;
};

const getTypeShape = (node: TSESTree.TypeNode): Shape => {
    if (isBooleanNode(node)) {
        return "boolean";
    }

    if (node.type === AST_NODE_TYPES.TSFunctionType) {
        return getFunctionShape(node);
    }

    if (node.type === AST_NODE_TYPES.TSUnionType) {
        return getUnionShape(node);
    }

    if (node.type === AST_NODE_TYPES.TSTypeReference || node.type === AST_NODE_TYPES.TSTypeOperator) {
        return "unknown";
    }

    return "other";
};

const getAnnotationShape = (annotation: TSESTree.TSTypeAnnotation | undefined): Shape =>
    annotation === undefined ? "unknown" : getTypeShape(annotation.typeAnnotation);

const isComparison = (node: TSESTree.Node): boolean =>
    node.type === AST_NODE_TYPES.BinaryExpression && COMPARISONS.has(node.operator);

const isNegation = (node: TSESTree.Node): boolean =>
    node.type === AST_NODE_TYPES.UnaryExpression && node.operator === "!";

const getLiteralValueShape = (node: TSESTree.Literal): Shape =>
    typeof node.value === "boolean" ? "boolean" : "other";

const getInitShape = (node: TSESTree.Node): Shape => {
    if (node.type === AST_NODE_TYPES.Literal) {
        return getLiteralValueShape(node);
    }

    return isComparison(node) || isNegation(node) ? "boolean" : "unknown";
};

const getDeclaratorShape = (node: TSESTree.VariableDeclarator): Shape => {
    if (node.id.type === AST_NODE_TYPES.Identifier && node.id.typeAnnotation !== undefined) {
        return getAnnotationShape(node.id.typeAnnotation);
    }

    const init = node.init ?? null;

    return init === null ? "unknown" : getInitShape(init);
};

const describeShape = (shape: Shape): string => (shape === "other" ? "a non-boolean value" : "a value");

const getBooleanViolation = (name: string): MessageIds | undefined => {
    if (NEGATED.test(name)) {
        return "negated";
    }

    return PREFIX.test(name) ? undefined : "missingPrefix";
};

const getViolation = (name: string, shape: Shape): MessageIds | undefined => {
    if (shape === "boolean") {
        return getBooleanViolation(name);
    }

    return shape === "other" && PREFIX.test(name) ? "notBoolean" : undefined;
};

const report = (context: Context, node: TSESTree.Node, name: string, shape: Shape): void => {
    const messageId = getViolation(name, shape);

    if (messageId === undefined) {
        return;
    }

    context.report({ node, messageId, data: { name, prefixes: PREFIX_LIST, shape: describeShape(shape) } });
};

export { booleanName };
