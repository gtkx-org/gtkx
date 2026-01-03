/**
 * Widget Meta Builder
 *
 * Builds CodegenWidgetMeta for in-memory metadata during generation.
 * This metadata is consumed by React generators - nothing is written to output files.
 */

import type { GirRepository, GirClass, QualifiedName } from "@gtkx/gir";
import { parseQualifiedName, qualifiedName } from "@gtkx/gir";
import type { ConstructorAnalyzer, PropertyAnalyzer, SignalAnalyzer } from "../../../core/analyzers/index.js";
import type { CodegenWidgetMeta } from "../../../core/codegen-metadata.js";
import { normalizeClassName, toKebabCase } from "../../../core/utils/naming.js";
import { isContainerMethod, isWidgetType } from "../../../core/utils/widget-detection.js";

export type WidgetMetaAnalyzers = {
    readonly property: PropertyAnalyzer;
    readonly signal: SignalAnalyzer;
    readonly constructor: ConstructorAnalyzer;
};

export class WidgetMetaBuilder {
    private readonly widgetQualifiedName: QualifiedName;

    constructor(
        private readonly cls: GirClass,
        private readonly repository: GirRepository,
        private readonly namespace: string,
        private readonly analyzers: WidgetMetaAnalyzers,
    ) {
        this.widgetQualifiedName = qualifiedName("Gtk", "Widget");
    }

    isWidget(): boolean {
        return this.cls.isSubclassOf(this.widgetQualifiedName);
    }

    buildCodegenWidgetMeta(): CodegenWidgetMeta | null {
        if (!this.isWidget()) {
            return null;
        }

        const className = normalizeClassName(this.cls.name, this.namespace);
        const properties = this.analyzers.property.analyzeWidgetProperties(this.cls);
        const signals = this.analyzers.signal.analyzeWidgetSignals(this.cls);
        const propNames = properties.filter((p) => p.isWritable).map((p) => p.name);
        const constructorParams = this.analyzers.constructor.getConstructorParamNames(this.cls);
        const parentInfo = this.extractParentInfo();

        return {
            className,
            namespace: this.namespace,
            jsxName: `${this.namespace}${className}`,
            isContainer: this.detectIsContainer(),
            slots: this.detectSlots(),
            propNames,
            signalNames: signals.map((s) => s.name),
            parentClassName: parentInfo?.className ?? null,
            parentNamespace: parentInfo?.namespace ?? null,
            modulePath: `./${toKebabCase(this.cls.name)}.js`,
            properties,
            signals,
            constructorParams,
        };
    }

    private detectIsContainer(): boolean {
        const allMethods = this.cls.getAllMethods();
        for (const method of allMethods) {
            if (isContainerMethod(method.name)) {
                return true;
            }
        }

        const allProperties = this.cls.getAllProperties();
        for (const prop of allProperties) {
            if (prop.writable && isWidgetType(prop.type.name, this.repository, this.widgetQualifiedName)) {
                return true;
            }
        }

        return false;
    }

    private detectSlots(): string[] {
        const slots: string[] = [];

        for (const prop of this.cls.properties) {
            if (!prop.writable) continue;

            if (isWidgetType(prop.type.name, this.repository, this.widgetQualifiedName)) {
                slots.push(prop.name);
            }
        }

        return slots;
    }

    private extractParentInfo(): { className: string; namespace: string } | null {
        const parent = this.cls.parent;
        if (!parent) return null;

        if (parent.includes(".")) {
            const { namespace: parentNs, name } = parseQualifiedName(parent as QualifiedName);
            return {
                className: normalizeClassName(name, parentNs),
                namespace: parentNs,
            };
        }

        return {
            className: normalizeClassName(parent, this.namespace),
            namespace: this.namespace,
        };
    }
}
