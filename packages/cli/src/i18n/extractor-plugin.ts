import type { Plugin, PluginContext } from "i18next-cli";
import {
    type BindingExtraction,
    extractBindings,
    type ScopeInfo,
} from "./binding-extractor.js";

type GtkxExtractorPlugin = {
    plugin: Plugin;
    transComponents: string[];
};

type ExtractorState = {
    extraction: BindingExtraction;
    sentinel: string;
};

type ReconciledNodes = {
    blocked: Set<string>;
    calls: Set<string>;
    trans: Set<string>;
};

const emptyExtraction = (): BindingExtraction => ({
    blockedGetFixedT: new Set(),
    calls: new Map(),
    errors: [],
    messages: [],
    trans: new Map(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const nodeSpanKey = (node: Record<string, unknown>): string | undefined => {
    if (!isRecord(node.span)) {
        return;
    }

    return typeof node.span.start === "number" && typeof node.span.end === "number"
        ? `${String(node.span.start)}:${String(node.span.end)}`
        : undefined;
};

const identifier = (value: string, source: unknown): Record<string, unknown> => {
    const span = isRecord(source) && isRecord(source.span) ? source.span : { end: 0, start: 0 };

    return {
        ctxt: 0,
        optional: false,
        span,
        type: "Identifier",
        value,
    };
};

const sentinelFor = (code: string): string => {
    let sentinel = "__gtkxI18nSentinel";

    while (new RegExp(String.raw`\b${sentinel}\b`, "u").test(code)) {
        sentinel += "_";
    }

    return sentinel;
};

const canonicalSource = (code: string): string => {
    const hasBom = code.startsWith("\u{FEFF}");
    let hashbangIndex = -1;

    if (code.startsWith("#!")) {
        hashbangIndex = 0;
    } else if (hasBom && code.startsWith("#!", 1)) {
        hashbangIndex = 1;
    }

    let canonical = hasBom ? ` ${code.slice(1)}` : code;

    if (hashbangIndex !== -1) {
        canonical = `${canonical.slice(0, hashbangIndex)}//${canonical.slice(hashbangIndex + 2)}`;
    }

    return `;${canonical}`;
};

const replaceCallCallee = (node: Record<string, unknown>, sentinel: string): void => {
    node.callee = identifier(sentinel, node.callee);
};

const replaceJsxName = (element: unknown, sentinel: string): void => {
    if (!isRecord(element)) {
        return;
    }

    if (isRecord(element.opening)) {
        element.opening.name = identifier(sentinel, element.opening.name);
    }

    if (isRecord(element.closing)) {
        element.closing.name = identifier(sentinel, element.closing.name);
    }
};

const isJsxAttribute = (value: unknown): value is Record<string, unknown> =>
    isRecord(value) && value.type === "JSXAttribute";

const isTAttributeName = (value: unknown): boolean =>
    isRecord(value) && value.value === "t";

const isExpressionContainer = (value: unknown): value is Record<string, unknown> =>
    isRecord(value) && value.type === "JSXExpressionContainer";

const transTExpression = (attribute: unknown): Record<string, unknown> | undefined => {
    if (!isJsxAttribute(attribute)) {
        return;
    }

    if (!isTAttributeName(attribute.name)) {
        return;
    }

    if (!isExpressionContainer(attribute.value)) {
        return;
    }

    return attribute.value;
};

const replaceTransTProp = (
    element: Record<string, unknown>,
    sentinel: string,
    info: ScopeInfo | null,
    context: PluginContext,
): void => {
    if (info === null || !isRecord(element.opening) || !Array.isArray(element.opening.attributes)) {
        return;
    }

    for (const attribute of element.opening.attributes) {
        const expression = transTExpression(attribute);

        if (expression === undefined) {
            continue;
        }

        context.setVarInScope(sentinel, info);
        expression.expression = identifier(sentinel, expression.expression);

        return;
    }
};

const reconcileBlockedNode = (
    value: Record<string, unknown>,
    key: string,
    extraction: BindingExtraction,
    reconciled: ReconciledNodes,
): void => {
    if (value.type !== "VariableDeclarator") {
        return;
    }

    if (!extraction.blockedGetFixedT.has(key)) {
        return;
    }

    blockUnrelatedGetFixedT(value);
    reconciled.blocked.add(key);
};

const reconcileCallNode = (
    value: Record<string, unknown>,
    key: string,
    extraction: BindingExtraction,
    reconciled: ReconciledNodes,
): void => {
    if (value.type === "CallExpression" && extraction.calls.has(key)) {
        reconciled.calls.add(key);
    }
};

const reconcileTransNode = (
    value: Record<string, unknown>,
    key: string,
    extraction: BindingExtraction,
    reconciled: ReconciledNodes,
): void => {
    if (value.type === "JSXElement" && extraction.trans.has(key)) {
        reconciled.trans.add(key);
    }
};

const reconcileNode = (
    value: Record<string, unknown>,
    extraction: BindingExtraction,
    reconciled: ReconciledNodes,
): void => {
    const key = nodeSpanKey(value);

    if (key === undefined) {
        return;
    }

    reconcileBlockedNode(value, key, extraction, reconciled);
    reconcileCallNode(value, key, extraction, reconciled);
    reconcileTransNode(value, key, extraction, reconciled);
};

const visitModuleChild = (
    child: unknown,
    extraction: BindingExtraction,
    reconciled: ReconciledNodes,
): void => {
    if (Array.isArray(child)) {
        for (const item of child) {
            visitModuleNode(item, extraction, reconciled);
        }

        return;
    }

    visitModuleNode(child, extraction, reconciled);
};

const visitModuleNode = (
    value: unknown,
    extraction: BindingExtraction,
    reconciled: ReconciledNodes,
): void => {
    if (!isRecord(value)) {
        return;
    }

    reconcileNode(value, extraction, reconciled);

    for (const [name, child] of Object.entries(value)) {
        if (name !== "span") {
            visitModuleChild(child, extraction, reconciled);
        }
    }
};

const wasExtractionReconciled = (
    extraction: BindingExtraction,
    reconciled: ReconciledNodes,
): boolean =>
    reconciled.blocked.size === extraction.blockedGetFixedT.size &&
    reconciled.calls.size === extraction.calls.size &&
    reconciled.trans.size === extraction.trans.size;

const blockUnrelatedGetFixedT = (declarator: Record<string, unknown>): void => {
    if (!isRecord(declarator.init) || !isRecord(declarator.init.callee)) {
        return;
    }

    const callee = declarator.init.callee;

    if (
        callee.type === "MemberExpression" &&
        isRecord(callee.property) &&
        callee.property.value === "getFixedT"
    ) {
        callee.property.value = "__gtkxIgnoredGetFixedT";
    }
};

const prepareModule = (
    module: Record<string, unknown>,
    extraction: BindingExtraction,
    context: PluginContext,
): void => {
    const reconciled: ReconciledNodes = {
        blocked: new Set(),
        calls: new Set(),
        trans: new Set(),
    };

    visitModuleNode(module, extraction, reconciled);

    if (!wasExtractionReconciled(extraction, reconciled)) {
        context.logger.warn("GTKX could not reconcile the binding-aware and i18next syntax trees");
    }
};

const submitMessages = (
    extraction: BindingExtraction,
    context: PluginContext,
): void => {
    for (const error of extraction.errors) {
        context.logger.warn(error);
    }

    for (const message of extraction.messages) {
        context.addKey({
            key: message.key,
            defaultValue: message.defaultValue,
            explicitDefault: message.explicitDefault,
            locations: [message.location],
            ...(message.ns !== undefined && { ns: message.ns }),
        });
    }
};

const loadSource = async (
    state: ExtractorState,
    transComponents: string[],
    code: string,
    path: string,
): Promise<string> => {
    const canonical = canonicalSource(code);
    state.extraction = await extractBindings(canonical, path);
    state.sentinel = sentinelFor(canonical);
    transComponents.splice(0, transComponents.length, state.sentinel);

    return canonical;
};

const visitCall = (
    state: ExtractorState,
    node: Record<string, unknown>,
    key: string,
    context: PluginContext,
): void => {
    const call = state.extraction.calls.get(key);

    if (call !== undefined) {
        context.setVarInScope(state.sentinel, call.info);
        replaceCallCallee(node, state.sentinel);
    }
};

const visitTrans = (
    state: ExtractorState,
    node: Record<string, unknown>,
    key: string,
    context: PluginContext,
): void => {
    const transInfo = state.extraction.trans.get(key);

    if (transInfo !== undefined) {
        const tSentinel = `${state.sentinel}T`;
        replaceJsxName(node, state.sentinel);
        replaceTransTProp(node, tSentinel, transInfo, context);
    }
};

const visitMatchedNode = (
    state: ExtractorState,
    node: Record<string, unknown>,
    key: string,
    context: PluginContext,
): void => {
    if (node.type === "VariableDeclarator" && state.extraction.blockedGetFixedT.has(key)) {
        blockUnrelatedGetFixedT(node);

        return;
    }

    if (node.type === "CallExpression") {
        visitCall(state, node, key, context);

        return;
    }

    if (node.type === "JSXElement") {
        visitTrans(state, node, key, context);
    }
};

const visitNode = (
    state: ExtractorState,
    node: unknown,
    context: PluginContext,
): void => {
    if (!isRecord(node)) {
        return;
    }

    if (node.type === "Module") {
        prepareModule(node, state.extraction, context);
        submitMessages(state.extraction, context);

        return;
    }

    const key = nodeSpanKey(node);

    if (key !== undefined) {
        visitMatchedNode(state, node, key, context);
    }
};

const gtkxExtractorPlugin = (): GtkxExtractorPlugin => {
    const state: ExtractorState = {
        extraction: emptyExtraction(),
        sentinel: "__gtkxI18nSentinel",
    };

    const transComponents: string[] = [];

    const plugin: Plugin = {
        name: "gtkx-react-i18next",
        onLoad: loadSource.bind(undefined, state, transComponents),
        onVisitNode: visitNode.bind(undefined, state),
    };

    return {
        plugin,
        transComponents,
    };
};

export { gtkxExtractorPlugin };
