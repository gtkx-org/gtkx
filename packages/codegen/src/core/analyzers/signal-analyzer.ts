import type { GirClass, GirRepository, GirSignal } from "@gtkx/gir";
import type { SignalAnalysis, SignalParam } from "../generator-types.js";
import type { FfiMapper } from "../type-system/ffi-mapper.js";
import type { TypeImport } from "../type-system/ffi-types.js";
import { collectExternalNamespaces } from "../type-system/ffi-types.js";
import { collectDirectMembers, collectParentSignalNames } from "../utils/class-traversal.js";
import { createHandlerName, toCamelCase } from "../utils/naming.js";
import { splitQualifiedName } from "../utils/qualified-name.js";
import { qualifyType } from "../utils/type-qualification.js";

const GOBJECT_OBJECT = "GObject.Object";
const CLASSES_WITH_NOTIFY = new Set<string>(["Gtk.Widget", "Gtk.EventController"]);

/**
 * Analyzes signals for JSX component generation.
 * Works directly with GirClass and FfiMapper.
 */
export class SignalAnalyzer {
    constructor(
        private readonly repo: GirRepository,
        private readonly ffiMapper: FfiMapper,
    ) {}

    /**
     * Analyzes signals for a widget class.
     * Returns only the signals directly defined on this class (not inherited from any parent).
     * For Gtk.Widget and Gtk.EventController, also includes the notify signal from GObject.Object.
     */
    analyzeWidgetSignals(cls: GirClass): SignalAnalysis[] {
        const { namespace } = splitQualifiedName(cls.qualifiedName);

        const directSignals = collectDirectMembers({
            cls,
            repo: this.repo,
            getClassMembers: (c) => c.signals,
            getInterfaceMembers: (i) => i.signals,
            getParentNames: collectParentSignalNames,
            transformName: toCamelCase,
        });

        const signals = directSignals.map((signal) => this.analyzeSignal(signal, namespace));

        if (CLASSES_WITH_NOTIFY.has(cls.qualifiedName)) {
            const notifySignal = this.getNotifySignalFromGObject(namespace);
            if (notifySignal) {
                signals.push(notifySignal);
            }
        }

        return signals;
    }

    private getNotifySignalFromGObject(namespace: string): SignalAnalysis | null {
        const gobjectClass = this.repo.resolveClass(GOBJECT_OBJECT);
        if (!gobjectClass) return null;

        const notifySignal = gobjectClass.signals.find((s) => s.name === "notify");
        if (!notifySignal) return null;

        return this.analyzeSignal(notifySignal, namespace);
    }

    private analyzeSignal(signal: GirSignal, namespace: string): SignalAnalysis {
        const camelName = toCamelCase(signal.name);
        const handlerName = createHandlerName(camelName);

        const allImports: TypeImport[] = [];

        const parameters: SignalParam[] = signal.parameters.map((param) => {
            const typeMapping = this.ffiMapper.mapParameter(param);
            allImports.push(...typeMapping.imports);
            return {
                name: toCamelCase(param.name),
                type: qualifyType(typeMapping.ts, namespace),
            };
        });

        let returnType = "void";
        if (signal.returnType) {
            const returnMapping = this.ffiMapper.mapType(signal.returnType, true, signal.returnType.transferOwnership);
            returnType = qualifyType(returnMapping.ts, namespace);
            allImports.push(...returnMapping.imports);
        }

        return {
            name: signal.name,
            camelName,
            handlerName,
            parameters,
            returnType,
            doc: signal.doc,
            referencedNamespaces: collectExternalNamespaces(allImports),
        };
    }
}
