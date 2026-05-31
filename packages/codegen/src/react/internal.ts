import { camelCase, quote, toIdentifier } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirRepository } from "../gir/repository.js";
import { implementedInterfaces, isReactNodeClass, iterateClassesWithGlibName, signalHandlerName } from "./widgets.js";

/**
 * Generates `internal.ts` source — the `SIGNALS` and `CONSTRUCT_ONLY_PROPS`
 * tables consumed by the React metadata resolver.
 *
 * Walks every widget across every loaded namespace and emits one entry
 * per GLib type name. Signals are mapped from kebab-case to `onCamelCase`;
 * construct-only properties are surfaced as a `Set` for the runtime to
 * consult on mount.
 *
 * @param repository - The loaded GIR repository
 */
export const generateInternal = (repository: GirRepository): string => {
    const widgets = collectWidgets(repository);
    const signalsEntries = widgets.map(
        ({ glibName, signals }) => `    "${glibName}": ${renderSignalsObject(signals)},`,
    );
    const constructOnlyEntries = widgets
        .filter(({ constructOnly }) => constructOnly.length > 0)
        .map(({ glibName, constructOnly }) => `    "${glibName}": new Set([${constructOnly.map(quote).join(",")}]),`);

    const namespaces = [...new Set(widgets.map((widget) => widget.namespace))].sort((a, b) => a.localeCompare(b));
    const preamble = namespaces.map((name) => `import "@gtkx/ffi/${name.toLowerCase()}";`).join("\n");

    return `${[
        preamble,
        `export const SIGNALS: Readonly<Record<string, Readonly<Record<string, string>>>> = {\n${signalsEntries.join("\n")}\n};`,
        `export const CONSTRUCT_ONLY_PROPS: Readonly<Record<string, ReadonlySet<string>>> = {\n${constructOnlyEntries.join("\n")}\n};`,
    ].join("\n\n")}\n`;
};

type WidgetEntry = {
    readonly glibName: string;
    readonly namespace: string;
    readonly signals: ReadonlyArray<readonly [string, string]>;
    readonly constructOnly: readonly string[];
};

const collectWidgets = (repository: GirRepository): readonly WidgetEntry[] => {
    const entries: WidgetEntry[] = [];
    for (const { glibName, klass, namespace } of iterateClassesWithGlibName(repository)) {
        if (!isReactNodeClass(klass, namespace, repository)) continue;
        const sources = [klass, ...implementedInterfaces(klass, namespace, repository).map((entry) => entry.klass)];
        entries.push({
            glibName,
            namespace: namespace.name,
            signals: collectSignals(sources),
            constructOnly: collectConstructOnly(sources),
        });
    }
    return entries.sort((a, b) => a.glibName.localeCompare(b.glibName));
};

const collectSignals = (sources: readonly GirClass[]): ReadonlyArray<readonly [string, string]> => {
    const seen = new Set<string>();
    const signals: Array<readonly [string, string]> = [];
    for (const source of sources) {
        for (const signal of source.signals) {
            const handlerName = signalHandlerName(signal.name);
            if (seen.has(handlerName)) continue;
            seen.add(handlerName);
            signals.push([handlerName, signal.name] as const);
        }
    }
    return signals;
};

const collectConstructOnly = (sources: readonly GirClass[]): readonly string[] => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const source of sources) {
        for (const property of source.properties) {
            if (!property.constructOnly) continue;
            const jsName = toIdentifier(camelCase(property.name));
            if (seen.has(jsName)) continue;
            seen.add(jsName);
            names.push(jsName);
        }
    }
    return names;
};

const renderSignalsObject = (entries: ReadonlyArray<readonly [string, string]>): string => {
    if (entries.length === 0) return "{}";
    const lines = entries.map(([key, value]) => `        ${quote(key)}: ${quote(value)}`);
    return `{\n${lines.join(",\n")}\n    }`;
};
