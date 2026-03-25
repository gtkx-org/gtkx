/**
 * Internal Generator
 *
 * Generates internal.ts for the reconciler.
 * Contains runtime prop/signal resolution and construction metadata.
 */

import type { FileBuilder } from "../../builders/index.js";
import { raw, variableStatement } from "../../builders/index.js";
import type { Writer } from "../../builders/writer.js";
import type { CodegenControllerMeta } from "../../core/codegen-metadata.js";
import type { PropertyAnalysis, SignalAnalysis } from "../../core/generator-types.js";

import { type MetadataReader, sortWidgetsByClassName } from "../metadata-reader.js";

type ClassItem = {
    readonly jsxName: string;
    readonly properties: readonly PropertyAnalysis[];
    readonly signals: readonly SignalAnalysis[];
};

export class InternalGenerator {
    constructor(
        private readonly reader: MetadataReader,
        private readonly controllers: readonly CodegenControllerMeta[],
    ) {}

    generate(file: FileBuilder): void {
        file.add(
            raw(
                "/**\n" +
                    " * Internal metadata for the reconciler.\n" +
                    " * Runtime prop/signal resolution and construction metadata.\n" +
                    " * Not part of the public API.\n" +
                    " */\n",
            ),
        );

        const items = this.collectClassItems();

        this.addTypeImports(file);
        this.generateConstructionMeta(file, items);
        this.generatePropsMap(file, items);
        this.generateSignalsMap(file, items);
    }

    private collectClassItems(): ClassItem[] {
        const widgets = sortWidgetsByClassName(this.reader.getAllWidgets());
        const controllers = [...this.controllers].sort((a, b) => a.className.localeCompare(b.className));

        const metaByJsxName = new Map(this.reader.getAllCodegenMeta().map((m) => [m.jsxName, m]));

        const items: ClassItem[] = [];

        for (const widget of widgets) {
            const meta = metaByJsxName.get(widget.jsxName);
            if (meta) items.push(meta);
        }

        for (const controller of controllers) {
            items.push(controller);
        }

        return items;
    }

    private addTypeImports(file: FileBuilder): void {
        file.addTypeImport("@gtkx/ffi", ["Type"]);
    }

    private generateConstructionMeta(file: FileBuilder, items: readonly ClassItem[]): void {
        const entries: Array<{ jsxName: string; propEntries: Array<[string, string]> }> = [];

        for (const item of items) {
            const propEntries: Array<[string, string]> = [];

            for (const prop of item.properties) {
                if (!prop.isWritable || !prop.ffiType) continue;
                const base = `{ girName: "${prop.name}", ffiType: ${JSON.stringify(prop.ffiType)}`;
                const value = prop.isConstructOnly ? `${base}, constructOnly: true as const }` : `${base} }`;
                propEntries.push([`"${prop.camelName}"`, value]);
            }

            if (propEntries.length > 0) {
                entries.push({ jsxName: item.jsxName, propEntries });
            }
        }

        file.add(
            variableStatement("CONSTRUCTION_META", {
                exported: true,
                kind: "const",
                type: "Record<string, Record<string, { girName: string; ffiType: Type; constructOnly?: true }>>",
                initializer: (writer: Writer) => {
                    writeNestedObject(writer, entries);
                },
                doc: "Construction metadata for all writable properties. Used by the reconciler to create widgets via g_object_new_with_properties.",
            }),
        );
    }

    private generatePropsMap(file: FileBuilder, items: readonly ClassItem[]): void {
        const entries: Array<{ jsxName: string; propEntries: Array<[string, string]> }> = [];

        for (const item of items) {
            if (item.properties.length === 0) continue;

            const propEntries: Array<[string, string]> = [];

            for (const prop of item.properties) {
                if (!prop.isWritable || (!prop.setter && !prop.isConstructOnly)) continue;

                propEntries.push([`"${prop.camelName}"`, `"${prop.camelName}"`]);
            }

            if (propEntries.length > 0) {
                entries.push({ jsxName: item.jsxName, propEntries });
            }
        }

        file.add(
            variableStatement("PROPS", {
                exported: true,
                kind: "const",
                type: "Record<string, Record<string, string>>",
                initializer: (writer: Writer) => {
                    writeNestedObject(writer, entries);
                },
            }),
        );
    }

    private generateSignalsMap(file: FileBuilder, items: readonly ClassItem[]): void {
        const entries: Array<{ jsxName: string; propEntries: Array<[string, string]> }> = [];

        for (const item of items) {
            if (item.signals.length === 0) continue;

            const signalEntries: Array<[string, string]> = [];

            for (const signal of item.signals) {
                signalEntries.push([`"${signal.handlerName}"`, `"${signal.name}"`]);
            }

            if (signalEntries.length > 0) {
                entries.push({ jsxName: item.jsxName, propEntries: signalEntries });
            }
        }

        file.add(
            variableStatement("SIGNALS", {
                exported: true,
                kind: "const",
                type: "Record<string, Record<string, string>>",
                initializer: (writer: Writer) => {
                    writeNestedObject(writer, entries);
                },
                doc: "Signal handler prop name to GTK signal name mapping for widgets and controllers.",
            }),
        );
    }
}

function writeNestedObject(
    writer: Writer,
    entries: Array<{ jsxName: string; propEntries: Array<[string, string]> }>,
): void {
    if (entries.length === 0) {
        writer.write("{}");
        return;
    }

    writer.writeBlock(() => {
        for (const { jsxName, propEntries } of entries) {
            writer.write(`${jsxName}: `);
            writer.writeBlock(() => {
                for (const [key, value] of propEntries) {
                    writer.writeLine(`${key}: ${value},`);
                }
            });
            writer.writeLine(",");
        }
    });
}
