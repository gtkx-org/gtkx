import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GirClass, GirNamespace } from "@gtkx/gir";
import { buildClassMap, GirParser, registerEnumsFromNamespace, TypeMapper, TypeRegistry } from "@gtkx/gir";
import { defineCommand } from "citty";
import { JsxGenerator } from "../jsx/index.js";
import { intro, log, outro, spinner } from "../progress.js";

const WIDGET_NAMESPACES = ["Gtk-4.0.gir", "Adw-1.gir", "GtkSource-5.gir", "Vte-3.91.gir", "WebKit-6.0.gir"];

const DEPENDENCY_NAMESPACES = [
    "GLib-2.0.gir",
    "GObject-2.0.gir",
    "Gio-2.0.gir",
    "Gdk-4.0.gir",
    "Gsk-4.0.gir",
    "Pango-1.0.gir",
    "GdkPixbuf-2.0.gir",
    "Graphene-1.0.gir",
    "cairo-1.0.gir",
];

export { WIDGET_NAMESPACES, DEPENDENCY_NAMESPACES };

export const jsx = defineCommand({
    meta: {
        name: "jsx",
        description: "Generate JSX type definitions from GIR files",
    },
    args: {
        "girs-dir": {
            type: "string",
            description: "Directory containing GIR files",
            required: true,
        },
        "output-dir": {
            type: "string",
            description: "Output directory for generated files",
            required: true,
        },
    },
    run: async ({ args }) => {
        const girsDir = args["girs-dir"];
        const outputDir = args["output-dir"];

        intro("Generating JSX types");

        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
            log.info(`Created output directory: ${outputDir}`);
        }

        const parseSpinner = spinner("Parsing GIR files");

        const allNamespacesForRegistry: GirNamespace[] = [];
        for (const filename of DEPENDENCY_NAMESPACES) {
            const filePath = join(girsDir, filename);
            if (!existsSync(filePath)) {
                continue;
            }

            const girContent = readFileSync(filePath, "utf-8");
            const parser = new GirParser();
            const namespace = parser.parse(girContent);
            allNamespacesForRegistry.push(namespace);
        }

        const widgetNamespaces: GirNamespace[] = [];
        for (const filename of WIDGET_NAMESPACES) {
            const filePath = join(girsDir, filename);
            if (!existsSync(filePath)) {
                log.warning(`Skipping ${filename} (not found)`);
                continue;
            }

            const girContent = readFileSync(filePath, "utf-8");
            const parser = new GirParser();
            const namespace = parser.parse(girContent);
            widgetNamespaces.push(namespace);
            allNamespacesForRegistry.push(namespace);
            parseSpinner.message(`Parsed ${namespace.name}`);
        }
        parseSpinner.stop(`Parsed ${widgetNamespaces.length} widget namespaces`);

        const combinedClassMap = new Map<string, GirClass>();
        for (const ns of widgetNamespaces) {
            const nsClassMap = buildClassMap(ns.classes);
            for (const [name, cls] of nsClassMap) {
                combinedClassMap.set(`${ns.name}.${name}`, cls);
                if (ns.name === "Gtk") {
                    combinedClassMap.set(name, cls);
                }
            }
        }

        const typeRegistry = TypeRegistry.fromNamespaces(allNamespacesForRegistry);
        const typeMapper = new TypeMapper();
        for (const ns of widgetNamespaces) {
            registerEnumsFromNamespace(typeMapper, ns);
        }

        const gtkNamespace = widgetNamespaces.find((ns) => ns.name === "Gtk");
        if (!gtkNamespace) {
            log.error("GTK namespace is required");
            process.exit(1);
        }

        typeMapper.setTypeRegistry(typeRegistry, gtkNamespace.name);

        const genSpinner = spinner("Generating JSX types");

        const generator = new JsxGenerator(typeMapper, typeRegistry, combinedClassMap, {});

        const result = await generator.generate(widgetNamespaces);

        const jsxOutputFile = join(outputDir, "jsx.ts");
        const internalOutputFile = join(outputDir, "internal.ts");
        const registryOutputFile = join(outputDir, "registry.ts");

        writeFileSync(jsxOutputFile, result.jsx);
        genSpinner.message("Wrote jsx.ts");

        writeFileSync(internalOutputFile, result.internal);
        genSpinner.message("Wrote internal.ts");

        writeFileSync(registryOutputFile, result.registry);
        genSpinner.stop("Wrote registry.ts");

        outro("JSX generation complete");
    },
});
