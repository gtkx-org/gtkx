import type { ConfigLoader } from "@gtkx/config";
import type { Plugin, UserConfig } from "vite";
import { type GeneratedElement, readGeneratedElements, resolveStore } from "@gtkx/codegen";
import { createConfigLoader } from "@gtkx/config/internal";
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

type PluginState = {
    isEnabled: boolean;
    isBuild: boolean;
    root: string;
    elements: Map<string, GeneratedElement> | null;
};

const ANIMATED_PACKAGE = "@gtkx/animated";
const CORE_SPECIFIER = "@gtkx/animated/core";
const VIRTUAL_ID = "virtual:gtkx-animated";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;
const NAMESPACE_HELPER = "__gtkxAnimated";
const CALL_HELPER = "__gtkxWithAnimated";

const isAstNode = (value: unknown): value is AstNode =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as AstNode).type === "string" &&
    typeof (value as AstNode).start === "number" &&
    typeof (value as AstNode).end === "number";

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

    for (const key of Object.keys(value)) {
        if (key !== "type") {
            walk(value[key], value, visit);
        }
    }
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

const animatedLocalName = (program: AstNode): string | undefined => {
    let local: string | undefined;

    walk(program, null, (node) => {
        if (node.type !== "ImportDeclaration" || (node.source as AstNode | undefined)?.value !== ANIMATED_PACKAGE) {
            return;
        }

        if (node.importKind === "type") {
            return;
        }

        for (const specifier of (node.specifiers as unknown[] | undefined) ?? []) {
            if (!isAstNode(specifier) || specifier.type !== "ImportSpecifier" || specifier.importKind === "type") {
                continue;
            }

            if (identifierName(specifier.imported) === "animated") {
                local ??= identifierName(specifier.local);
            }
        }
    });

    return local;
};

const countDeclarations = (program: AstNode, name: string): number => {
    let count = 0;

    walk(program, null, (node, parent) => {
        if (node.type !== "Identifier" && node.type !== "BindingIdentifier") {
            return;
        }

        if (node.name !== name || parent === null) {
            return;
        }

        const isBinding =
            (parent.type === "VariableDeclarator" && parent.id === node) ||
            (parent.type === "ImportSpecifier" && parent.local === node) ||
            (parent.type === "ImportDefaultSpecifier" && parent.local === node) ||
            (parent.type === "ImportNamespaceSpecifier" && parent.local === node) ||
            ((parent.type === "FunctionDeclaration" || parent.type === "ClassDeclaration") && parent.id === node) ||
            (parent.type === "CatchClause" && parent.param === node) ||
            (parent.type === "FormalParameter" && parent.pattern === node);

        if (isBinding) {
            count += 1;
        }
    });

    return count;
};

const isRewritableMember = (node: AstNode, parent: AstNode | null, local: string): boolean => {
    if (node.type === "JSXMemberExpression") {
        return identifierName(node.object) === local;
    }

    if (node.type !== "MemberExpression" || node.computed === true || node.optional === true) {
        return false;
    }

    if (identifierName(node.object) !== local) {
        return false;
    }

    if (parent === null) {
        return true;
    }

    if (parent.type === "AssignmentExpression" && parent.left === node) {
        return false;
    }

    if (parent.type === "UpdateExpression" && parent.argument === node) {
        return false;
    }

    return !(parent.type === "UnaryExpression" && parent.operator === "delete" && parent.argument === node);
};

const collectRewrite = (program: AstNode, local: string, elements: Map<string, GeneratedElement>): Rewrite => {
    const rewrite: Rewrite = { edits: [], hasMemberEdits: false, hasCallEdits: false, hasDynamicUses: false };
    const claimed: Set<number> = new Set();

    walk(program, null, (node, parent) => {
        if (isRewritableMember(node, parent, local)) {
            const property = identifierName(node.property);

            if (property !== undefined && elements.get(property)?.isMountable === true) {
                const object = node.object as AstNode;
                rewrite.edits.push({ start: object.start, end: object.end, replacement: NAMESPACE_HELPER });
                rewrite.hasMemberEdits = true;
                claimed.add(object.start);
            }

            return;
        }

        if (node.type === "CallExpression" && identifierName(node.callee) === local) {
            const callee = node.callee as AstNode;
            rewrite.edits.push({ start: callee.start, end: callee.end, replacement: CALL_HELPER });
            rewrite.hasCallEdits = true;
            claimed.add(callee.start);
        }
    });

    walk(program, null, (node, parent) => {
        if (identifierName(node) !== local || claimed.has(node.start)) {
            return;
        }

        if (parent?.type === "ImportSpecifier" || parent?.type === "MemberExpression" && parent.property === node) {
            return;
        }

        if (parent?.type === "JSXMemberExpression" && parent.property === node) {
            return;
        }

        rewrite.hasDynamicUses = true;
    });

    return rewrite;
};

const lastImportEnd = (program: AstNode): number => {
    let end = 0;

    for (const statement of (program.body as unknown[] | undefined) ?? []) {
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
        lines.push(`import { withAnimated as ${CALL_HELPER} } from ${JSON.stringify(CORE_SPECIFIER)};`);
    }

    return lines.join("\n");
};

const applyEdits = (code: string, edits: Edit[]): string => {
    let result = code;

    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
        result = `${result.slice(0, edit.start)}${edit.replacement}${result.slice(edit.end)}`;
    }

    return result;
};

const rewriteModule = (
    code: string,
    id: string,
    elements: Map<string, GeneratedElement>,
): { code: string; hasDynamicUses: boolean } | undefined => {
    const path = stripQuery(id);
    const lang = sourceLanguage(path);

    if (lang === undefined || code.includes(NAMESPACE_HELPER)) {
        return undefined;
    }

    const parsed = parseSync(path, code, { lang });

    if (parsed.errors.length > 0) {
        return undefined;
    }

    const program = parsed.program as unknown as AstNode;
    const local = animatedLocalName(program);

    if (local === undefined || countDeclarations(program, local) > 1) {
        return undefined;
    }

    const rewrite = collectRewrite(program, local, elements);

    if (rewrite.edits.length === 0) {
        return undefined;
    }

    const insertAt = lastImportEnd(program);
    const edited = applyEdits(code, rewrite.edits);
    const withHelpers =
        `${edited.slice(0, insertAt)}\n${helperImports(rewrite)}${edited.slice(insertAt)}`;

    return { code: withHelpers, hasDynamicUses: rewrite.hasDynamicUses };
};

const renderVirtualModule = (elements: Map<string, GeneratedElement>): string => {
    const mountable = [...elements.values()].filter((element) => element.isMountable);
    const imports = mountable.map((element) => `${element.glibName} as $${element.glibName}`);

    const consts = mountable.map(
        (element) => `export const ${element.glibName} = /* @__PURE__ */ withAnimated($${element.glibName});`,
    );

    return (
        `import { ${imports.join(", ")} } from "@gtkx/jsx";\n` +
        `import { withAnimated } from ${JSON.stringify(CORE_SPECIFIER)};\n` +
        `${consts.join("\n")}\n`
    );
};

const loadElements = (state: PluginState): Map<string, GeneratedElement> | null => {
    if (state.elements !== null) {
        return state.elements;
    }

    try {
        const store = resolveStore(state.root);
        const jsxStoreDir = store.jsx?.storeDir;

        if (jsxStoreDir === undefined) {
            return null;
        }

        state.elements = new Map(readGeneratedElements(jsxStoreDir).map((element) => [element.glibName, element]));
    } catch {
        return null;
    }

    return state.elements;
};

/**
 * Rewrites static uses of the `animated` surface so tree shaking can drop the widgets an app never
 * animates: member accesses such as `animated.GtkLabel` become reads of a generated
 * `virtual:gtkx-animated` module holding one pre-wrapped component per element, and the call form's
 * callee becomes the `withAnimated` of `@gtkx/animated/core`, none of which import the runtime
 * Proxy over the whole `@gtkx/jsx` namespace. A dynamic use of the binding keeps the Proxy import
 * and, with it, every generated widget; production builds warn when that happens. Active only when
 * the project opts into `future.v2TreeShaking`.
 */
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
            if (state.isEnabled && source === VIRTUAL_ID) {
                return RESOLVED_VIRTUAL_ID;
            }

            return undefined;
        },

        load(id) {
            if (!state.isEnabled || id !== RESOLVED_VIRTUAL_ID) {
                return undefined;
            }

            const elements = loadElements(state);

            return elements === null ? undefined : renderVirtualModule(elements);
        },

        transform(code, id) {
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

            if (rewritten.hasDynamicUses && state.isBuild) {
                this.warn(
                    `${stripQuery(id)} uses the animated binding dynamically, which keeps the whole generated ` +
                    "widget namespace in the bundle; use animated.GtkX member access or animated(Component) " +
                    "calls to let unused widgets be dropped",
                );
            }

            return rewritten.code;
        },
    };
}

export { gtkxAnimated };
