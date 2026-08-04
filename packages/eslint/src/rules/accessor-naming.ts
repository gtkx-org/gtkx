import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { getIdentifierName } from "./identifier-name.js";

type MessageIds = "ofSuffix" | "mixedShape" | "typeSuffix" | "tableSuffix";
type Kind = "function" | "value" | "type" | "unknown";
type Context = TSESLint.RuleContext<MessageIds, []>;

const OF_SUFFIX = /[a-z0-9]Of$/;
const FOR_SUFFIX = /[a-z0-9]For$/;
const GET_PREFIX = /^get[A-Z]/;

const FUNCTION_VALUES: Set<AST_NODE_TYPES> = new Set<AST_NODE_TYPES>([
    AST_NODE_TYPES.ArrowFunctionExpression,
    AST_NODE_TYPES.FunctionExpression,
]);

const accessorNaming = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Name a read `get<Noun>` and a keyed lookup `<noun>For`, and keep those two shapes from mixing",
        },
        messages: {
            ofSuffix:
                "`{{name}}` ends in `Of`. Call it `get{{noun}}` when it reads a value off its argument, " +
                "or `{{stem}}For` when it looks the value up in a table keyed by its argument.",
            mixedShape:
                "`{{name}}` carries both the `get` prefix and the `{{suffix}}` suffix, which are the two " +
                "competing shapes. Keep the prefix for a read or the suffix for a keyed lookup, not both.",
            typeSuffix: "Type `{{name}}` ends in `{{suffix}}`. Types take a plain noun, so drop the suffix.",
            tableSuffix:
                "`{{name}}` holds a value rather than a function, so `{{suffix}}` names a lookup it never " +
                "performs. Name it for what it holds.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const check = (name: string | undefined, node: TSESTree.Node, kind: Kind): void => {
            report(context, name, node, kind);
        };

        return {
            FunctionDeclaration: (node): void => {
                check(getIdentifierName(node.id), node, "function");
            },
            TSDeclareFunction: (node): void => {
                check(getIdentifierName(node.id), node, "function");
            },
            VariableDeclarator: (node): void => {
                check(getIdentifierName(node.id), node, getInitKind(node.init));
            },
            MethodDefinition: (node): void => {
                check(getIdentifierName(node.key), node, "function");
            },
            PropertyDefinition: (node): void => {
                check(getIdentifierName(node.key), node, getInitKind(node.value));
            },
            Property: (node): void => {
                check(getIdentifierName(node.key), node, getInitKind(node.value));
            },
            TSMethodSignature: (node): void => {
                check(getIdentifierName(node.key), node, "function");
            },
            TSPropertySignature: (node): void => {
                check(getIdentifierName(node.key), node, getSignatureKind(node));
            },
            TSTypeAliasDeclaration: (node): void => {
                check(getIdentifierName(node.id), node, "type");
            },
            TSInterfaceDeclaration: (node): void => {
                check(getIdentifierName(node.id), node, "type");
            },
        };
    },
});

const getInitKind = (node: TSESTree.Node | null | undefined): Kind =>
    node !== null && node !== undefined && FUNCTION_VALUES.has(node.type) ? "function" : "unknown";

const getSignatureKind = (node: TSESTree.TSPropertySignature): Kind =>
    node.typeAnnotation?.typeAnnotation.type === AST_NODE_TYPES.TSFunctionType ? "function" : "value";

const hasSuffix = (name: string): boolean => OF_SUFFIX.test(name) || FOR_SUFFIX.test(name);
const getSuffix = (name: string): string => (OF_SUFFIX.test(name) ? "Of" : "For");
const getTypeViolation = (name: string): MessageIds | undefined => (hasSuffix(name) ? "typeSuffix" : undefined);

const getValueViolation = (name: string, kind: Kind): MessageIds | undefined => {
    if (OF_SUFFIX.test(name)) {
        return "ofSuffix";
    }

    if (kind === "value" && FOR_SUFFIX.test(name)) {
        return "tableSuffix";
    }

    return undefined;
};

const getViolation = (name: string, kind: Kind): MessageIds | undefined => {
    if (kind === "type") {
        return getTypeViolation(name);
    }

    if (GET_PREFIX.test(name) && hasSuffix(name)) {
        return "mixedShape";
    }

    return getValueViolation(name, kind);
};

const getData = (name: string): Record<string, string> => {
    const suffix = getSuffix(name);
    const stem = name.slice(0, -suffix.length);

    return { name, suffix, stem, noun: stem.charAt(0).toUpperCase() + stem.slice(1) };
};

const report = (context: Context, name: string | undefined, node: TSESTree.Node, kind: Kind): void => {
    if (name === undefined) {
        return;
    }

    const messageId = getViolation(name, kind);

    if (messageId === undefined) {
        return;
    }

    context.report({ node, messageId, data: getData(name) });
};

export { accessorNaming };
