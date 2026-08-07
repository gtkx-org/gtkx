import { AST_TOKEN_TYPES, ESLintUtils, type TSESTree } from "@typescript-eslint/utils";

type MessageIds = "prohibitedComment";

const SHEBANG = "Shebang";

const DIRECTIVE_PATTERNS = [
    /^\/\s*<reference\s/,
    /^\s*@ts-expect-error\b/,
    /^\s*eslint(?:-disable|-enable)?\b/,
    /^\s*@vite-ignore\b/,
    /^\s*(?:v8|c8|istanbul|node)\s+ignore\b/,
];

const noComments = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description: "Disallow every comment that is neither JSDoc nor a directive a tool actually reads",
        },
        messages: {
            prohibitedComment:
                "Remove this comment. Only JSDoc on the public API and tool directives belong in the tree; " +
                "clarify anything else through naming and structure.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        return {
            Program(): void {
                for (const comment of context.sourceCode.getAllComments()) {
                    if (!isAllowed(comment)) {
                        context.report({ loc: comment.loc, messageId: "prohibitedComment" });
                    }
                }
            },
        };
    },
});

const isJsDoc = (comment: TSESTree.Comment): boolean =>
    comment.type === AST_TOKEN_TYPES.Block && comment.value.startsWith("*");

const isDirective = (comment: TSESTree.Comment): boolean =>
    DIRECTIVE_PATTERNS.some((pattern) => pattern.test(comment.value));

const isShebang = (comment: TSESTree.Comment): boolean => (comment.type as string) === SHEBANG;

const isAllowed = (comment: TSESTree.Comment): boolean =>
    isJsDoc(comment) || isDirective(comment) || isShebang(comment);

export { noComments };
