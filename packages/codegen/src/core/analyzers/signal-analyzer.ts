import type { GirRepository, NormalizedClass, NormalizedSignal } from "@gtkx/gir";
import { parseQualifiedName } from "@gtkx/gir";
import type { SignalAnalysis, SignalParam } from "../generator-types.js";
import type { FfiMapper } from "../type-system/ffi-mapper.js";
import { collectExternalNamespaces } from "../type-system/ffi-types.js";
import { collectDirectMembers, collectParentSignalNames } from "../utils/class-traversal.js";
import { toCamelCase } from "../utils/naming.js";
import { qualifyType } from "../utils/type-qualification.js";

/**
 * Analyzes signals for JSX component generation.
 * Works directly with NormalizedClass and FfiMapper.
 */
export class SignalAnalyzer {
    constructor(
        private readonly repo: GirRepository,
        private readonly ffiMapper: FfiMapper,
    ) {}

    /**
     * Analyzes signals for a widget class.
     * Returns only the signals directly defined on this class (not inherited from any parent).
     */
    analyzeWidgetSignals(cls: NormalizedClass): SignalAnalysis[] {
        const { namespace } = parseQualifiedName(cls.qualifiedName);

        const directSignals = collectDirectMembers({
            cls,
            repo: this.repo,
            getClassMembers: (c) => c.signals,
            getInterfaceMembers: (i) => i.signals,
            getParentNames: collectParentSignalNames,
            transformName: toCamelCase,
        });

        return directSignals.map((signal) => this.analyzeSignal(signal, namespace));
    }

    private analyzeSignal(signal: NormalizedSignal, namespace: string): SignalAnalysis {
        const camelName = toCamelCase(signal.name);
        const handlerName = `on${camelName.charAt(0).toUpperCase()}${camelName.slice(1)}`;

        const allImports: import("../type-system/ffi-types.js").TypeImport[] = [];

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
            const returnMapping = this.ffiMapper.mapType(signal.returnType);
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
