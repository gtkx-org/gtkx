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
        this.emitMap(file, "CONSTRUCTION_META", {
            type: "Record<string, Record<string, { girName: string; ffiType: Type; constructOnly?: true }>>",
            doc: "Construction metadata for all writable properties. Used by the reconciler to create widgets via g_object_new_with_properties.",
            items,
            collect: (item) => {
                const entries: Array<[string, string]> = [];
                for (const prop of item.properties) {
                    if (!prop.isWritable || !prop.ffiType) continue;
                    const base = `{ girName: "${prop.name}", ffiType: ${JSON.stringify(prop.ffiType)}`;
                    const value = prop.isConstructOnly ? `${base}, constructOnly: true as const }` : `${base} }`;
                    entries.push([`"${prop.camelName}"`, value]);
                }
                return entries;
            },
        });
    }

    private generatePropsMap(file: FileBuilder, items: readonly ClassItem[]): void {
        this.emitMap(file, "PROPS", {
            type: "Record<string, Record<string, string>>",
            items,
            skipIf: (item) => item.properties.length === 0,
            collect: (item) => {
                const entries: Array<[string, string]> = [];
                for (const prop of item.properties) {
                    if (!prop.isWritable || (!prop.setter && !prop.isConstructOnly)) continue;
                    entries.push([`"${prop.camelName}"`, `"${prop.camelName}"`]);
                }
                return entries;
            },
        });
    }

    private generateSignalsMap(file: FileBuilder, items: readonly ClassItem[]): void {
        this.emitMap(file, "SIGNALS", {
            type: "Record<string, Record<string, string>>",
            doc: "Signal handler prop name to GTK signal name mapping for widgets and controllers.",
            items,
            skipIf: (item) => item.signals.length === 0,
            collect: (item) =>
                item.signals.map((signal) => [`"${signal.handlerName}"`, `"${signal.name}"`] as [string, string]),
        });
    }

    private emitMap(
        file: FileBuilder,
        name: string,
        opts: {
            type: string;
            doc?: string;
            items: readonly ClassItem[];
            skipIf?: (item: ClassItem) => boolean;
            collect: (item: ClassItem) => Array<[string, string]>;
        },
    ): void {
        const entries: Array<{ jsxName: string; propEntries: Array<[string, string]> }> = [];

        for (const item of opts.items) {
            if (opts.skipIf?.(item)) continue;
            const propEntries = opts.collect(item);
            if (propEntries.length > 0) {
                entries.push({ jsxName: item.jsxName, propEntries });
            }
        }

        file.add(
            variableStatement(name, {
                exported: true,
                kind: "const",
                type: opts.type,
                initializer: (writer: Writer) => {
                    writeNestedObject(writer, entries);
                },
                doc: opts.doc,
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
