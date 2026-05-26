/**
 * Class Meta Builder
 *
 * Builds CodegenWidgetMeta and CodegenControllerMeta for in-memory metadata during generation.
 * This metadata is consumed by React generators - nothing is written to output files.
 */

import type { PropertyAnalyzer, SignalAnalyzer } from "../../../analyzers/index.js";
import type {
    CodegenControllerMeta,
    CodegenLayoutManagerMeta,
    CodegenNonWidgetClassMeta,
    CodegenWidgetMeta,
} from "../../../codegen-metadata.js";
import { getContainerMethodNames, getHiddenPropNames } from "../../../config/index.js";
import type { GirClass, GirRepository } from "../../../gir/index.js";
import { normalizeClassName, toKebabCase } from "../../../utils/naming.js";
import { splitQualifiedName } from "../../../utils/qualified-name.js";
import { isWidgetType } from "../../../utils/widget-detection.js";

export type ClassMetaAnalyzers = {
    readonly property: PropertyAnalyzer;
    readonly signal: SignalAnalyzer;
};

export class ClassMetaBuilder {
    private readonly widgetQualifiedName = "Gtk.Widget";
    private readonly eventControllerQualifiedName = "Gtk.EventController";
    private readonly layoutManagerQualifiedName = "Gtk.LayoutManager";

    constructor(
        private readonly cls: GirClass,
        private readonly repository: GirRepository,
        private readonly namespace: string,
        private readonly analyzers: ClassMetaAnalyzers,
    ) {}

    isWidget(): boolean {
        return this.cls.isSubclassOf(this.widgetQualifiedName);
    }

    isEventController(): boolean {
        if (this.cls.qualifiedName === this.eventControllerQualifiedName) return true;
        return this.cls.isSubclassOf(this.eventControllerQualifiedName);
    }

    isLayoutManager(): boolean {
        if (this.cls.qualifiedName === this.layoutManagerQualifiedName) return true;
        return this.cls.isSubclassOf(this.layoutManagerQualifiedName);
    }

    buildCodegenControllerMeta(): CodegenControllerMeta | null {
        if (!this.isEventController()) {
            return null;
        }

        return this.buildNonWidgetMeta();
    }

    buildCodegenLayoutManagerMeta(): CodegenLayoutManagerMeta | null {
        if (!this.isLayoutManager()) {
            return null;
        }

        return this.buildNonWidgetMeta();
    }

    private buildNonWidgetMeta(): CodegenNonWidgetClassMeta {
        const className = normalizeClassName(this.cls.name);
        const properties = this.analyzers.property.analyzeWidgetProperties(this.cls, new Set());
        const signals = this.analyzers.signal.analyzeWidgetSignals(this.cls);
        const propNames = properties.filter((p) => p.isWritable).map((p) => p.camelName);
        const parentInfo = this.extractParentInfo();

        return {
            className,
            namespace: this.namespace,
            jsxName: `${this.namespace}${className}`,
            parentClassName: parentInfo?.className ?? null,
            parentNamespace: parentInfo?.namespace ?? null,
            propNames,
            signalNames: signals.map((s) => s.name),
            properties,
            signals,
            doc: this.cls.doc,
            abstract: this.cls.abstract,
        };
    }

    buildCodegenWidgetMeta(): CodegenWidgetMeta | null {
        if (!this.isWidget()) {
            return null;
        }

        const className = normalizeClassName(this.cls.name);
        const hiddenPropNames = getHiddenPropNames(className);
        const hiddenPropsSet = new Set(hiddenPropNames);
        const properties = this.analyzers.property.analyzeWidgetProperties(this.cls, hiddenPropsSet);
        const signals = this.analyzers.signal.analyzeWidgetSignals(this.cls);
        const propNames = properties.filter((p) => p.isWritable).map((p) => p.name);
        const parentInfo = this.extractParentInfo();

        return {
            className,
            namespace: this.namespace,
            jsxName: `${this.namespace}${className}`,
            slots: this.detectSlots(),
            containerMethods: this.detectContainerMethods(className),
            propNames,
            signalNames: signals.map((s) => s.name),
            parentClassName: parentInfo?.className ?? null,
            parentNamespace: parentInfo?.namespace ?? null,
            modulePath: `./${toKebabCase(this.cls.name)}.js`,
            properties,
            signals,
            doc: this.cls.doc,
            hiddenPropNames,
        };
    }

    private detectContainerMethods(className: string): string[] {
        const jsxName = `${this.namespace}${className}`;
        const allowedNames = getContainerMethodNames(jsxName);
        if (allowedNames.length === 0) return [];

        const allowedSet = new Set(allowedNames);
        const found: string[] = [];

        for (const method of this.cls.methods) {
            if (!allowedSet.has(method.name.replaceAll("_", "-"))) continue;
            found.push(method.name.replaceAll("_", "-"));
        }

        return found;
    }

    private detectSlots(): string[] {
        const slots: string[] = [];

        for (const prop of this.cls.properties) {
            if (!prop.writable) continue;
            if (prop.name === "child") continue;

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
            const { namespace: parentNs, name } = splitQualifiedName(parent);
            return {
                className: normalizeClassName(name),
                namespace: parentNs,
            };
        }

        return {
            className: normalizeClassName(parent),
            namespace: this.namespace,
        };
    }
}
