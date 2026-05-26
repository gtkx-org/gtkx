/**
 * Layout Manager Props Builder
 *
 * Builds layout manager props interfaces from GIR-derived metadata.
 * Generates pure GIR translations -- no reconciler-specific knowledge.
 */

import type { InterfaceDeclarationBuilder } from "../../../builders/index.js";
import { interfaceDecl } from "../../../builders/index.js";
import type { CodegenLayoutManagerMeta } from "../../../codegen-metadata.js";
import { toPascalCase } from "../../../utils/naming.js";
import { type PropInfo, PropsBuilderBase } from "./props-builder-base.js";

export class LayoutManagerPropsBuilder extends PropsBuilderBase {
    buildBaseLayoutManagerPropsInterface(layoutManagerMeta: CodegenLayoutManagerMeta): InterfaceDeclarationBuilder {
        const { namespace } = layoutManagerMeta;

        const allProps: PropInfo[] = [
            ...this.collectPropInfos(layoutManagerMeta.properties, namespace).map((p) => ({ ...p, optional: true })),
            ...this.collectSignalInfos(layoutManagerMeta.signals, "LayoutManager", namespace),
            { name: "children", type: "ReactNode", optional: true },
        ];

        const iface = interfaceDecl("LayoutManagerBaseProps", {
            exported: true,
            doc: layoutManagerMeta.doc
                ? this.formatDocDescription(layoutManagerMeta.doc, namespace)
                : "Base props for all layout manager elements.",
        });

        this.applyProps(iface, allProps);
        return iface;
    }

    buildLayoutManagerPropsInterface(layoutManager: CodegenLayoutManagerMeta): InterfaceDeclarationBuilder | null {
        if (layoutManager.className === "LayoutManager") return null;

        const { namespace, jsxName, className } = layoutManager;
        const layoutManagerName = toPascalCase(className);

        const allProps: PropInfo[] = [
            ...this.collectPropInfos(layoutManager.properties, namespace).map((p) => ({ ...p, optional: true })),
            ...this.collectSignalInfos(layoutManager.signals, className, namespace),
            { name: "ref", type: `Ref<${namespace}.${layoutManagerName}>`, optional: true },
        ];

        const parentPropsName = this.resolveParentPropsName(
            {
                namespace,
                parentClassName:
                    layoutManager.parentClassName === "LayoutManager" ? null : layoutManager.parentClassName,
                parentNamespace: layoutManager.parentNamespace,
            },
            "LayoutManagerBaseProps",
        );

        const iface = interfaceDecl(`${jsxName}Props`, {
            exported: true,
            extends: [parentPropsName],
            doc: `Props for the \`${jsxName}\` layout manager element.`,
        });

        this.applyProps(iface, allProps);
        return iface;
    }
}
