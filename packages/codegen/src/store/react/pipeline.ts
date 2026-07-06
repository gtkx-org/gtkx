import { type ResolvedGtkxRules, resolveGtkxRules } from "@gtkx/config";
import { sortedStringsBy } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import { type GirNamespace, namespaceDirectory } from "../../gir/namespace.js";
import { ImportsBuilder } from "../../writer/imports.js";
import { generateElementComponentsSection } from "./element-components.js";
import { collectIntrinsicElementClasses } from "./intrinsic-elements.js";
import { generateJsxSection } from "./jsx.js";
import { generateMetadata } from "./metadata.js";
import { assembleRuleTables } from "./rule-tables.js";
import { createRuleTypegen, type RuleTypegen } from "./synthetic-prop-types.js";
import { DEFAULT_BLOCKABLE_TYPES } from "./tables.js";

export type JsxNamespaceFile = {
    directory: string;
    source: string;
};

export type JsxFiles = {
    namespaces: JsxNamespaceFile[];
    metadata: string;
    intrinsicElementCount: number;
};

export const generateJsxFiles = (library: Library, userRules?: ResolvedGtkxRules): JsxFiles => {
    const namespacesWithIntrinsicElements = new Map<string, GirNamespace>();
    for (const entry of collectIntrinsicElementClasses(library)) {
        namespacesWithIntrinsicElements.set(entry.namespace.name, entry.namespace);
    }

    const ruleTables = assembleRuleTables(library, resolveGtkxRules(userRules));
    const typegen = createRuleTypegen(library, ruleTables);

    const namespaces: JsxNamespaceFile[] = [];
    let intrinsicElementCount = 0;
    for (const namespace of sortedStringsBy(namespacesWithIntrinsicElements.values(), (entry) => entry.name)) {
        const { source, count } = generateJsxNamespace(namespace, library, typegen);
        namespaces.push({ directory: namespaceDirectory(namespace), source });
        intrinsicElementCount += count;
    }

    const metadata = generateMetadata(library, {
        defaultBlockableTypes: DEFAULT_BLOCKABLE_TYPES,
        relationships: ruleTables.relationships,
        syntheticProps: ruleTables.syntheticProps,
    });

    return { namespaces, metadata, intrinsicElementCount };
};

const generateJsxNamespace = (
    targetNamespace: GirNamespace,
    library: Library,
    typegen: RuleTypegen,
): { source: string; count: number } => {
    const targetDirectory = namespaceDirectory(targetNamespace);
    const imports = new ImportsBuilder();
    imports.addSideEffect(`@gtkx/gi/${targetDirectory}`);

    const elementComponents = generateElementComponentsSection(targetNamespace, library, { imports, typegen });
    const excludeNames = new Set<string>(elementComponents.exportedNames);
    const { source: jsxSection, intrinsicCount } = generateJsxSection(targetNamespace, library, {
        excludeNames,
        imports,
        typegen,
    });

    const body = [imports.toSource().trimEnd(), "", jsxSection];
    if (elementComponents.source.length > 0) body.push("", elementComponents.source);

    const count = elementComponents.exportedNames.size + intrinsicCount;
    return { source: `${body.join("\n")}\n`, count };
};
