/**
 * Controller Props Builder
 *
 * Builds controller props interfaces from GIR-derived metadata.
 * Generates pure GIR translations -- no reconciler-specific knowledge.
 */

import type { InterfaceDeclarationBuilder } from "../../../builders/index.js";
import { interfaceDecl } from "../../../builders/index.js";
import type { CodegenControllerMeta } from "../../../core/codegen-metadata.js";
import { toPascalCase } from "../../../core/utils/naming.js";
import { qualifyType } from "../../../core/utils/type-qualification.js";
import { type PropInfo, PropsBuilderBase } from "./props-builder-base.js";

export class ControllerPropsBuilder extends PropsBuilderBase {
    buildBaseControllerPropsInterface(eventControllerMeta: CodegenControllerMeta): InterfaceDeclarationBuilder {
        const { namespace } = eventControllerMeta;
        const allProps: PropInfo[] = [];

        for (const prop of eventControllerMeta.properties) {
            if (!prop.isWritable || (!prop.setter && !prop.isConstructOnly)) continue;
            this.trackNamespacesFromAnalysis(prop.referencedNamespaces);
            const qualifiedType = qualifyType(prop.type, namespace);
            const typeWithNull = prop.isNullable ? `${qualifiedType} | null` : qualifiedType;
            allProps.push({
                name: prop.camelName,
                type: typeWithNull,
                optional: true,
                doc: prop.doc ? this.formatDocDescription(prop.doc, namespace) : undefined,
            });
        }

        for (const signal of eventControllerMeta.signals) {
            this.trackNamespacesFromAnalysis(signal.referencedNamespaces);
            allProps.push({
                name: signal.handlerName,
                type: `${this.buildHandlerType(signal, "EventController", namespace)} | null`,
                optional: true,
                doc: signal.doc ? this.formatDocDescription(signal.doc, namespace) : undefined,
            });
        }

        allProps.push({
            name: "children",
            type: "ReactNode",
            optional: true,
        });

        const iface = interfaceDecl("EventControllerBaseProps", {
            exported: true,
            doc: eventControllerMeta.doc
                ? this.formatDocDescription(eventControllerMeta.doc, namespace)
                : "Base props for all event controller elements.",
        });

        for (const prop of allProps) {
            iface.addProperty({
                name: prop.name,
                type: prop.type,
                optional: prop.optional,
                doc: prop.doc,
            });
        }

        return iface;
    }

    buildControllerPropsInterface(controller: CodegenControllerMeta): InterfaceDeclarationBuilder | null {
        if (controller.className === "EventController") return null;

        const { namespace, jsxName, className } = controller;
        const allProps: PropInfo[] = [];

        for (const prop of controller.properties) {
            if (!prop.isWritable || (!prop.setter && !prop.isConstructOnly)) continue;
            this.trackNamespacesFromAnalysis(prop.referencedNamespaces);
            const qualifiedType = qualifyType(prop.type, namespace);
            const typeWithNull = prop.isNullable ? `${qualifiedType} | null` : qualifiedType;
            allProps.push({
                name: prop.camelName,
                type: typeWithNull,
                optional: true,
                doc: prop.doc ? this.formatDocDescription(prop.doc, namespace) : undefined,
            });
        }

        for (const signal of controller.signals) {
            this.trackNamespacesFromAnalysis(signal.referencedNamespaces);
            allProps.push({
                name: signal.handlerName,
                type: `${this.buildHandlerType(signal, className, namespace)} | null`,
                optional: true,
                doc: signal.doc ? this.formatDocDescription(signal.doc, namespace) : undefined,
            });
        }

        const controllerName = toPascalCase(className);

        allProps.push({
            name: "ref",
            type: `Ref<${namespace}.${controllerName}>`,
            optional: true,
        });

        const parentPropsName = this.getParentPropsName(controller);

        const iface = interfaceDecl(`${jsxName}Props`, {
            exported: true,
            extends: [parentPropsName],
            doc: `Props for the {@link ${jsxName}} controller element.`,
        });

        for (const prop of allProps) {
            iface.addProperty({
                name: prop.name,
                type: prop.type,
                optional: prop.optional,
                doc: prop.doc,
            });
        }

        return iface;
    }

    private knownJsxNames: ReadonlySet<string> = new Set<string>();

    setKnownJsxNames(names: ReadonlySet<string>): void {
        this.knownJsxNames = names;
    }

    private getParentPropsName(controller: CodegenControllerMeta): string {
        const { parentClassName, parentNamespace } = controller;

        if (!parentClassName || parentClassName === "EventController") {
            return "EventControllerBaseProps";
        }

        const ns = parentNamespace ?? controller.namespace;
        const parentJsxName = `${ns}${toPascalCase(parentClassName)}`;
        if (this.knownJsxNames.size > 0 && !this.knownJsxNames.has(parentJsxName)) {
            return "EventControllerBaseProps";
        }

        const baseName = toPascalCase(parentClassName);
        return `${ns}${baseName}Props`;
    }
}
