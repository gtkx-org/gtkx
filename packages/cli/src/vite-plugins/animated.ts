import type { ConfigLoader } from "@gtkx/config";
import type { Plugin, UserConfig } from "vite";
import { type GeneratedElement, readGeneratedElements } from "@gtkx/codegen";
import { createConfigLoader } from "@gtkx/config/internal";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { parseSync } from "vite";
import { sourceLanguage } from "../internal/source-imports.js";
import { stripQuery } from "./strip-query.js";

type AstNode = {
    type: string;
    start: number;
    end: number;
} & Record<string, unknown>;

type Edit = {
    start: number;
    end: number;
    replacement: string;
};

type Rewrite = {
    edits: Edit[];
    hasMemberEdits: boolean;
    hasCallEdits: boolean;
    hasDynamicUses: boolean;
};

type RewrittenModule = { code: string; hasDynamicUses: boolean; hasMemberEdits: boolean };

type PluginState = {
    isEnabled: boolean;
    isBuild: boolean;
    root: string;
    elements: Map<string, GeneratedElement> | null;
};

const ANIMATED_PACKAGE = "@gtkx/animated";
const INTERNAL_SPECIFIER = "@gtkx/animated/internal";
const VIRTUAL_ID = "virtual:gtkx-animated";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;
const NAMESPACE_HELPER = "__gtkxAnimated";
const CALL_HELPER = "__gtkxWithAnimated";

const BINDING_PARENT_KEYS: Record<string, string> = {
    VariableDeclarator: "id",
    ImportSpecifier: "local",
    ImportDefaultSpecifier: "local",
    ImportNamespaceSpecifier: "local",
    FunctionDeclaration: "id",
    ClassDeclaration: "id",
    CatchClause: "param",
    AssignmentPattern: "left",
    RestElement: "argument",
    Property: "value",
};

const BINDING_PARENT_ARRAY_KEYS: Record<string, string> = {
    ArrowFunctionExpression: "params",
    FunctionDeclaration: "params",
    FunctionExpression: "params",
    ArrayPattern: "elements",
};

const isAstNode = (value: unknown): value is AstNode =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as AstNode).type === "string" &&
    typeof (value as AstNode).start === "number" &&
    typeof (value as AstNode).end === "number";

const walkChildren = (node: AstNode, visit: (node: AstNode, parent: AstNode | null) => void): void => {
    for (const [key, child] of Object.entries(node)) {
        if (key !== "type") {
            walk(child, node, visit);
        }
    }
};

const walk = (value: unknown, parent: AstNode | null, visit: (node: AstNode, parent: AstNode | null) => void): void => {
    if (Array.isArray(value)) {
        for (const item of value) {
            walk(item, parent, visit);
        }

        return;
    }

    if (!isAstNode(value)) {
        return;
    }

    visit(value, parent);
    walkChildren(value, visit);
};

const identifierName = (node: unknown): string | undefined => {
    if (!isAstNode(node)) {
        return undefined;
    }

    if (node.type !== "Identifier" && node.type !== "JSXIdentifier") {
        return undefined;
    }

    return typeof node.name === "string" ? node.name : undefined;
};

const isValueImportSpecifier = (specifier: unknown): specifier is AstNode =>
    isAstNode(specifier) && specifier.type === "ImportSpecifier" && specifier.importKind !== "type";

const animatedSpecifierLocal = (node: AstNode): string | undefined => {
    const specifiers = (node.specifiers as unknown[] | undefined) ?? [];
    let local: string | undefined;

    for (const specifier of specifiers) {
        if (isValueImportSpecifier(specifier) && identifierName(specifier.imported) === "animated") {
            local ??= identifierName(specifier.local);
        }
    }

    return local;
};

const animatedLocalName = (program: AstNode): string | undefined => {
    let local: string | undefined;

    walk(program, null, (node) => {
        if (node.type !== "ImportDeclaration" || (node.source as AstNode | undefined)?.value !== ANIMATED_PACKAGE) {
            return;
        }

        if (node.importKind === "type") {
            return;
        }

        local ??= animatedSpecifierLocal(node);
    });

    return local;
};

const isBindingSlot = (node: AstNode, parent: AstNode): boolean => {
    const key = BINDING_PARENT_KEYS[parent.type];

    return key !== undefined && parent[key] === node;
};

const isBindingListEntry = (node: AstNode, parent: AstNode): boolean => {
    const arrayKey = BINDING_PARENT_ARRAY_KEYS[parent.type];
    const entries = arrayKey === undefined ? undefined : parent[arrayKey];

    return Array.isArray(entries) && entries.includes(node);
};

const isBindingParent = (node: AstNode, parent: AstNode): boolean =>
    isBindingSlot(node, parent) || isBindingListEntry(node, parent);

const isBindingNamed = (node: AstNode, parent: AstNode, name: string): boolean =>
    node.type === "Identifier" &&
    node.name === name &&
    isBindingParent(node, parent);

const countDeclarations = (program: AstNode, name: string): number => {
    const spans: Set<number> = new Set();

    walk(program, null, (node, parent) => {
        if (parent !== null && isBindingNamed(node, parent, name)) {
            spans.add(node.start);
        }
    });

    return spans.size;
};

const isRewritableJsxMember = (node: AstNode, local: string): boolean =>
    node.type === "JSXMemberExpression" && identifierName(node.object) === local;

const isRewritableObjectMember = (node: AstNode, local: string): boolean =>
    node.type === "MemberExpression" &&
    node.computed !== true &&
    node.optional !== true &&
    identifierName(node.object) === local;

const isForbiddenTarget = (node: AstNode, parent: AstNode | null): boolean =>
    parent !== null &&
    ((parent.type === "AssignmentExpression" && parent.left === node) ||
        (parent.type === "UpdateExpression" && parent.argument === node) ||
        (parent.type === "UnaryExpression" && parent.operator === "delete" && parent.argument === node));

const isRewritableMember = (node: AstNode, parent: AstNode | null, local: string): boolean => {
    if (isRewritableJsxMember(node, local)) {
        return true;
    }

    return isRewritableObjectMember(node, local) && !isForbiddenTarget(node, parent);
};

const collectMemberEdit = (
    rewrite: Rewrite,
    claimed: Set<number>,
    node: AstNode,
    elements: Map<string, GeneratedElement>,
): void => {
    const property = identifierName(node.property);

    if (property !== undefined && elements.get(property)?.isMountable === true) {
        const object = node.object as AstNode;
        rewrite.edits.push({ start: object.start, end: object.end, replacement: NAMESPACE_HELPER });
        rewrite.hasMemberEdits = true;
        claimed.add(object.start);
    }
};

const collectCallEdit = (rewrite: Rewrite, claimed: Set<number>, node: AstNode): void => {
    const callee = node.callee as AstNode;
    rewrite.edits.push({ start: callee.start, end: callee.end, replacement: CALL_HELPER });
    rewrite.hasCallEdits = true;
    claimed.add(callee.start);
};

const isPropertyReference = (node: AstNode, parent: AstNode | null): boolean =>
    parent?.type === "ImportSpecifier" ||
    (parent?.type === "MemberExpression" && parent.property === node) ||
    (parent?.type === "JSXMemberExpression" && parent.property === node);

const hasDynamicUse = (program: AstNode, local: string, claimed: Set<number>): boolean => {
    let isFound = false;

    walk(program, null, (node, parent) => {
        if (identifierName(node) === local && !claimed.has(node.start) && !isPropertyReference(node, parent)) {
            isFound = true;
        }
    });

    return isFound;
};

const collectRewrite = (program: AstNode, local: string, elements: Map<string, GeneratedElement>): Rewrite => {
    const rewrite: Rewrite = { edits: [], hasMemberEdits: false, hasCallEdits: false, hasDynamicUses: false };
    const claimed: Set<number> = new Set();

    walk(program, null, (node, parent) => {
        if (isRewritableMember(node, parent, local)) {
            collectMemberEdit(rewrite, claimed, node, elements);

            return;
        }

        if (node.type === "CallExpression" && identifierName(node.callee) === local) {
            collectCallEdit(rewrite, claimed, node);
        }
    });

    rewrite.hasDynamicUses = hasDynamicUse(program, local, claimed);

    return rewrite;
};

const lastImportEnd = (program: AstNode): number => {
    const statements = (program.body as unknown[] | undefined) ?? [];
    let end = 0;

    for (const statement of statements) {
        if (isAstNode(statement) && statement.type === "ImportDeclaration") {
            end = Math.max(end, statement.end);
        }
    }

    return end;
};

const helperImports = (rewrite: Rewrite): string => {
    const lines: string[] = [];

    if (rewrite.hasMemberEdits) {
        lines.push(`import * as ${NAMESPACE_HELPER} from ${JSON.stringify(VIRTUAL_ID)};`);
    }

    if (rewrite.hasCallEdits) {
        lines.push(`import { withAnimated as ${CALL_HELPER} } from ${JSON.stringify(INTERNAL_SPECIFIER)};`);
    }

    return lines.join("\n");
};

const applyEdits = (code: string, edits: Edit[]): string => {
    const ordered = edits.toSorted((a, b) => b.start - a.start);
    let result = code;

    for (const edit of ordered) {
        result = `${result.slice(0, edit.start)}${edit.replacement}${result.slice(edit.end)}`;
    }

    return result;
};

const parseProgram = (path: string, code: string): AstNode | undefined => {
    const lang = sourceLanguage(path);

    if (lang === undefined) {
        return undefined;
    }

    const parsed = parseSync(path, code, { lang });

    return parsed.errors.length > 0 ? undefined : (parsed.program as unknown as AstNode);
};

const unchangedRewrite = (code: string, rewrite: Rewrite): RewrittenModule | undefined =>
    rewrite.hasDynamicUses ? { code, hasDynamicUses: true, hasMemberEdits: false } : undefined;

const hasHelperCollision = (code: string): boolean =>
    code.includes(NAMESPACE_HELPER) || code.includes(CALL_HELPER);

const rewriteModule = (
    code: string,
    id: string,
    elements: Map<string, GeneratedElement>,
): RewrittenModule | undefined => {
    if (hasHelperCollision(code)) {
        return undefined;
    }

    const program = parseProgram(stripQuery(id), code);

    if (program === undefined) {
        return undefined;
    }

    const local = animatedLocalName(program);

    if (local === undefined || countDeclarations(program, local) > 1) {
        return undefined;
    }

    const rewrite = collectRewrite(program, local, elements);

    if (rewrite.edits.length === 0) {
        return unchangedRewrite(code, rewrite);
    }

    const insertAt = lastImportEnd(program);
    const helperEdit: Edit = { start: insertAt, end: insertAt, replacement: `\n${helperImports(rewrite)}` };
    const withHelpers = applyEdits(code, [...rewrite.edits, helperEdit]);

    return { code: withHelpers, hasDynamicUses: rewrite.hasDynamicUses, hasMemberEdits: rewrite.hasMemberEdits };
};

const renderVirtualModule = (elements: Map<string, GeneratedElement>): string => {
    const mountable = elements.values().filter((element) => element.isMountable).toArray();
    const imports = mountable.map((element) => `${element.glibName} as $${element.glibName}`);

    const consts = mountable.map(
        (element) => `export const ${element.glibName} = /* @__PURE__ */ withAnimated($${element.glibName});`,
    );

    return (
        `import { ${imports.join(", ")} } from "@gtkx/jsx";\n` +
        `import { withAnimated } from ${JSON.stringify(INTERNAL_SPECIFIER)};\n` +
        `${consts.join("\n")}\n`
    );
};

const loadElements = (state: PluginState): Map<string, GeneratedElement> | null => {
    if (state.elements !== null) {
        return state.elements;
    }

    try {
        const requireFromRoot = createRequire(join(state.root, "package.json"));
        const jsxStoreDir = dirname(requireFromRoot.resolve("@gtkx/jsx/package.json"));
        state.elements = new Map(readGeneratedElements(jsxStoreDir).map((element) => [element.glibName, element]));
    } catch {
        return null;
    }

    return state.elements;
};

const resolveVirtualId = (state: PluginState, source: string): string | undefined => {
    if (source === VIRTUAL_ID && state.isEnabled) {
        return RESOLVED_VIRTUAL_ID;
    }

    return undefined;
};

const loadVirtualModule = (state: PluginState, id: string): string | undefined => {
    if (id !== RESOLVED_VIRTUAL_ID || !state.isEnabled) {
        return undefined;
    }

    const elements = loadElements(state);

    return elements === null ? undefined : renderVirtualModule(elements);
};

const dynamicUseWarning = (id: string, hasDynamicUses: boolean): string[] =>
    hasDynamicUses
        ? [
                `${stripQuery(id)} uses the animated binding dynamically, which keeps the whole generated ` +
                "widget namespace in the bundle; use animated(Component) calls to let unused widgets be dropped",
            ]
        : [];

const memberUseWarning = (id: string, hasMemberEdits: boolean): string[] =>
    hasMemberEdits
        ? [
                `${stripQuery(id)} reads widget components off the animated binding, which GTKX 2.0 removes; ` +
                "import the component and call animated(Component) instead",
            ]
        : [];

const warningsFor = (state: PluginState, id: string, rewritten: RewrittenModule): string[] =>
    state.isBuild
        ? [
                ...dynamicUseWarning(id, rewritten.hasDynamicUses),
                ...memberUseWarning(id, rewritten.hasMemberEdits),
            ]
        : [];

const transformCode = (
    state: PluginState,
    code: string,
    id: string,
): { code: string; warnings: string[] } | undefined => {
    if (!state.isEnabled || id.startsWith("\0") || !code.includes(ANIMATED_PACKAGE)) {
        return undefined;
    }

    const elements = loadElements(state);

    if (elements === null) {
        return undefined;
    }

    const rewritten = rewriteModule(code, id, elements);

    if (rewritten === undefined) {
        return undefined;
    }

    return { code: rewritten.code, warnings: warningsFor(state, id, rewritten) };
};

function gtkxAnimated(loadConfig: ConfigLoader = createConfigLoader()): Plugin {
    const state: PluginState = { isEnabled: false, isBuild: false, root: process.cwd(), elements: null };

    return {
        name: "gtkx:animated",
        enforce: "pre",

        async config(config: UserConfig) {
            const loaded = await loadConfig.load(config.root ?? process.cwd());
            state.isEnabled = loaded.config.future?.v2TreeShaking === true;
        },

        configResolved(config) {
            state.root = config.root;
            state.isBuild = config.command === "build";
        },

        resolveId(source) {
            return resolveVirtualId(state, source);
        },

        load(id) {
            return loadVirtualModule(state, id);
        },

        transform(code, id) {
            const result = transformCode(state, code, id);
            const warnings = result?.warnings ?? [];

            for (const warning of warnings) {
                this.warn(warning);
            }

            return result?.code;
        },
    };
}

export { gtkxAnimated };
