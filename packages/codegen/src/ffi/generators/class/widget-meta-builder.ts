/**
 * Widget Meta Builder
 *
 * Generates WIDGET_META constant for widget classes.
 * This metadata is used by both JSX generation and the runtime reconciler.
 * Includes signal metadata for runtime signal resolution.
 *
 * Also builds CodegenWidgetMeta for in-memory metadata during generation.
 */

import type { GirRepository, NormalizedClass, QualifiedName } from "@gtkx/gir";
import { parseQualifiedName, qualifiedName } from "@gtkx/gir";
import type { ClassDeclaration, CodeBlockWriter } from "ts-morph";
import { type WriterFunction, Writers } from "ts-morph";
import type { ConstructorAnalyzer, PropertyAnalyzer, SignalAnalyzer } from "../../../core/analyzers/index.js";
import type { CodegenWidgetMeta } from "../../../core/codegen-metadata.js";
import type { GenerationContext } from "../../../core/generation-context.js";
import { normalizeClassName, toKebabCase } from "../../../core/utils/naming.js";
import { writeConstStringArray, writeObjectOrEmpty } from "../../../core/utils/structure-helpers.js";
import { isContainerMethod, isWidgetType } from "../../../core/utils/widget-detection.js";
import type { SignalMetaEntry } from "./signal-builder.js";

/**
 * Runtime widget metadata structure.
 * This is the shape of the WIDGET_META constant in generated FFI classes.
 * Used by the runtime reconciler for widget introspection.
 */
export type RuntimeWidgetMeta = {
    /** Widget can contain children */
    isContainer: boolean;
    /** Named slots for child widgets */
    slots: readonly string[];
    /** Property names that can be set as props */
    propNames: readonly string[];
    /** Signal metadata for this class (own signals only, not inherited) */
    signals: Record<string, { params: unknown[]; returnType?: unknown }>;
};

/**
 * Builds WIDGET_META constant for widget classes.
 *
 * Generates generic FFI metadata for widgets.
 * React-specific classification (isListWidget, etc.) is derived from
 * hardcoded constants in React codegen, not from this metadata.
 *
 * @example
 * Generated output:
 * ```typescript
 * export const WIDGET_META = {
 *   isContainer: true,
 *   slots: ["titleWidget"],
 *   propNames: ["label", "iconName", ...],
 *   signals: {
 *     "clicked": { params: [], returnType: { type: "undefined" } },
 *   },
 * } as const;
 * ```
 */
/**
 * Analyzers required by WidgetMetaBuilder.
 * These are injected via constructor for testability and reuse.
 */
export type WidgetMetaAnalyzers = {
    readonly property: PropertyAnalyzer;
    readonly signal: SignalAnalyzer;
    readonly constructor: ConstructorAnalyzer;
};

export class WidgetMetaBuilder {
    private readonly widgetQualifiedName: QualifiedName;
    private signalEntries: SignalMetaEntry[] = [];

    constructor(
        private readonly cls: NormalizedClass,
        private readonly repository: GirRepository,
        private readonly ctx: GenerationContext,
        private readonly namespace: string,
        private readonly analyzers: WidgetMetaAnalyzers,
    ) {
        this.widgetQualifiedName = qualifiedName("Gtk", "Widget");
    }

    /**
     * Sets the signal metadata entries for this class.
     * Should be called before addToSourceFile.
     *
     * @param entries - Array of structured signal metadata entries
     */
    setSignalEntries(entries: SignalMetaEntry[]): void {
        this.signalEntries = entries;
    }

    /**
     * Adds WIDGET_META as a static property on the class.
     *
     * This makes it accessible at runtime via `constructor.WIDGET_META`,
     * which is used by resolveSignalMeta to walk up the prototype chain.
     *
     * @param classDeclaration - The ts-morph ClassDeclaration to add the property to
     * @returns true if WIDGET_META was added (class is a widget), false otherwise
     *
     * @example
     * ```typescript
     * const analyzers = { property, signal, constructor };
     * const builder = new WidgetMetaBuilder(cls, repository, ctx, namespace, analyzers);
     * if (builder.addToClass(classDecl)) {
     *   // WIDGET_META was added as static property
     * }
     * ```
     */
    addToClass(classDeclaration: ClassDeclaration): boolean {
        if (!this.isWidget()) {
            return false;
        }

        this.ctx.usesRuntimeWidgetMeta = true;

        classDeclaration.addProperty({
            isStatic: true,
            isReadonly: true,
            name: "WIDGET_META",
            type: "RuntimeWidgetMeta",
            initializer: this.writeWidgetMetaInitializer(),
        });

        return true;
    }

    /**
     * Writes the WIDGET_META initializer using ts-morph Writers.object().
     * Uses structured signal data to avoid string parsing.
     */
    private writeWidgetMetaInitializer(): WriterFunction {
        const meta = this.computeMetadata();

        const signalsObject: Record<string, WriterFunction> = {};
        for (const entry of this.signalEntries) {
            signalsObject[`"${entry.name}"`] = Writers.object({
                params: (writer: CodeBlockWriter) => {
                    writer.write("[");
                    entry.params.forEach((param, i) => {
                        if (i > 0) writer.write(", ");
                        param(writer);
                    });
                    writer.write("]");
                },
                returnType: entry.returnType,
            });
        }

        return Writers.object({
            isContainer: String(meta.isContainer),
            slots: writeConstStringArray(meta.slots),
            propNames: writeConstStringArray(meta.propNames),
            signals: writeObjectOrEmpty(signalsObject, Writers),
        });
    }

    /**
     * Computes widget metadata (excluding signals which are set separately).
     */
    computeMetadata(): Omit<RuntimeWidgetMeta, "signals"> {
        const properties = this.analyzers.property.analyzeWidgetProperties(this.cls);
        return {
            isContainer: this.detectIsContainer(),
            slots: this.detectSlots(),
            propNames: properties.filter((p) => p.isWritable).map((p) => p.name),
        };
    }

    /**
     * Checks if the class is a widget.
     */
    isWidget(): boolean {
        return this.cls.isSubclassOf(this.widgetQualifiedName);
    }

    /**
     * Detects if the widget is a container.
     * Uses isContainerMethod and isWidgetType from utils/widget-detection.ts.
     */
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

    /**
     * Detects named slots (writable widget-type properties).
     */
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

    /**
     * Builds CodegenWidgetMeta for in-memory metadata storage.
     *
     * This pre-computes property and signal analysis that React generators need,
     * avoiding the need to re-parse GIR or generated code later.
     *
     * Note: isContainer, slots, and widget classification are NOT stored here.
     * They are derived by JSX generators from the FFI AST (WIDGET_META constant).
     *
     * @returns CodegenWidgetMeta if this is a widget, null otherwise
     */
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

    /**
     * Extracts parent class info including namespace for cross-namespace inheritance.
     */
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
