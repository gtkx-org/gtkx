import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { CONTIGUOUS, getSection } from "./sections.js";

type MessageIds = "missingPadding" | "unexpectedPadding" | "extraPadding";
type SourceCode = TSESLint.SourceCode;
type Anchor = TSESTree.Node | TSESTree.Comment;

type Pair = {
    previous: TSESTree.Node;
    next: TSESTree.Node;
    anchor: Anchor;
    blankLines: number;
    isBoundary: boolean;
    isContiguous: boolean;
};

type Violation = {
    messageId: MessageIds;
    data: Record<string, string | number>;
};

const statementPadding = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
    meta: {
        type: "layout",
        fixable: "whitespace",
        docs: {
            description:
                "Separate module sections, multiline statements and statements that return with one blank line, " +
                "and keep adjacent single-line statements together",
        },
        messages: {
            missingPadding: "Expected a blank line before this {{reason}}.",
            unexpectedPadding: "Unexpected blank line here; keep these statements together.",
            extraPadding: "Expected exactly one blank line here, found {{count}}.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const check = (statements: TSESTree.Node[], isSectioned: boolean): void => {
            for (const pair of getPairs(statements, context.sourceCode, isSectioned)) {
                report(context, pair);
            }
        };

        return {
            Program: (node): void => {
                check(node.body, true);
            },
            BlockStatement: (node): void => {
                check(node.body, false);
            },
            StaticBlock: (node): void => {
                check(node.body, false);
            },
            SwitchCase: (node): void => {
                check(node.consequent, false);
            },
            TSModuleBlock: (node): void => {
                check(node.body, false);
            },
        };
    },
});

const isMultiline = (node: TSESTree.Node): boolean => node.loc.start.line !== node.loc.end.line;
const isEmpty = (node: TSESTree.Node): boolean => node.type === AST_NODE_TYPES.EmptyStatement;

const isReturning = (node: TSESTree.Node): boolean => {
    if (node.type === AST_NODE_TYPES.ReturnStatement) {
        return true;
    }

    if (node.type !== AST_NODE_TYPES.IfStatement) {
        return false;
    }

    return isReturning(node.consequent) || (node.alternate !== null && isReturning(node.alternate));
};

const isPadded = (node: TSESTree.Node): boolean => isMultiline(node) || isReturning(node);

const getAnchor = (node: TSESTree.Node, previous: TSESTree.Node, source: SourceCode): Anchor => {
    const leading = source.getCommentsBefore(node).find((comment) => comment.loc.start.line > previous.loc.end.line);

    return leading ?? node;
};

const getPair = (previous: TSESTree.Node, next: TSESTree.Node, source: SourceCode, isSectioned: boolean): Pair => {
    const anchor = getAnchor(next, previous, source);
    const previousSection = getSection(previous);
    const nextSection = getSection(next);
    const isSameSection = previousSection === nextSection;
    const isKnown = previousSection !== undefined && nextSection !== undefined;

    return {
        previous,
        next,
        anchor,
        blankLines: anchor.loc.start.line - previous.loc.end.line - 1,
        isBoundary: isSectioned && isKnown && !isSameSection,
        isContiguous: isSectioned && isSameSection && previousSection !== undefined && CONTIGUOUS.has(previousSection),
    };
};

const getPairs = (statements: TSESTree.Node[], source: SourceCode, isSectioned: boolean): Pair[] => {
    const pairs: Pair[] = [];

    for (const [index, next] of statements.entries()) {
        const previous = statements[index - 1];

        if (previous === undefined || isEmpty(previous) || isEmpty(next)) {
            continue;
        }

        pairs.push(getPair(previous, next, source, isSectioned));
    }

    return pairs;
};

const padWith = (
    source: SourceCode,
    previous: TSESTree.Node,
    anchor: Anchor,
    newlines: number,
): TSESLint.ReportFixFunction =>
    (fixer) => {
        const between = source.getText().slice(previous.range[1], anchor.range[0]);
        const indent = between.slice(between.lastIndexOf("\n") + 1);

        return fixer.replaceTextRange([previous.range[1], anchor.range[0]], "\n".repeat(newlines) + indent);
    };

const requiresPadding = (pair: Pair): boolean =>
    !pair.isContiguous && (pair.isBoundary || isPadded(pair.previous) || isPadded(pair.next));

const getReason = (pair: Pair): string => {
    if (pair.isBoundary) {
        return `${String(getSection(pair.next))} section`;
    }

    if (isReturning(pair.next) || isReturning(pair.previous)) {
        return "return statement";
    }

    return "multiline statement";
};

const getViolation = (pair: Pair, wants: number): Violation => {
    if (wants === 0) {
        return { messageId: "unexpectedPadding", data: {} };
    }

    if (pair.blankLines === 0) {
        return { messageId: "missingPadding", data: { reason: getReason(pair) } };
    }

    return { messageId: "extraPadding", data: { count: pair.blankLines } };
};

const report = (context: TSESLint.RuleContext<MessageIds, []>, pair: Pair): void => {
    const { previous, next, anchor, blankLines } = pair;

    if (anchor.loc.start.line <= previous.loc.end.line) {
        return;
    }

    const wants = requiresPadding(pair) ? 1 : 0;

    if (blankLines === wants) {
        return;
    }

    const loc = context.sourceCode.getFirstToken(next)?.loc ?? next.loc;
    const violation = getViolation(pair, wants);

    context.report({
        loc,
        messageId: violation.messageId,
        data: violation.data,
        fix: padWith(context.sourceCode, previous, anchor, wants + 1),
    });
};

export { statementPadding };
