import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GirNamespace } from "@gtkx/gir";
import { GirParser, TypeRegistry } from "@gtkx/gir";
import { CodeGenerator } from "../src/codegen/ffi-generator.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(__dirname, "../../..");
const girsDir = join(workspaceRoot, "girs");
const systemGirsDir = "/usr/share/gir-1.0";
const outputDir = resolve(__dirname, "../src/generated");

const IMPORTANT_GIRS = new Set([
    "Adw-1.gir",
    "GLib-2.0.gir",
    "GModule-2.0.gir",
    "GObject-2.0.gir",
    "Gdk-4.0.gir",
    "GdkPixbuf-2.0.gir",
    "Gio-2.0.gir",
    "Graphene-1.0.gir",
    "Gsk-4.0.gir",
    "Gtk-4.0.gir",
    "GtkSource-5.gir",
    "HarfBuzz-0.0.gir",
    "Pango-1.0.gir",
    "PangoCairo-1.0.gir",
    "Secret-1.gir",
    "Vte-3.91.gir",
    "WebKit-6.0.gir",
    "cairo-1.0.gir",
    "freetype2-2.0.gir",
]);

const syncGirFiles = (): void => {
    console.log("Syncing GIR files from system to workspace...");

    if (!existsSync(girsDir)) {
        mkdirSync(girsDir, { recursive: true });
        console.log(`Created directory: ${girsDir}`);
    }

    const files = readdirSync(systemGirsDir).filter((f) => f.endsWith(".gir"));
    console.log(`Found ${files.length} GIR files in ${systemGirsDir}`);

    for (const file of files) {
        if (!IMPORTANT_GIRS.has(file)) continue;
        copyFileSync(join(systemGirsDir, file), join(girsDir, file));
        console.log(`Copied ${file}`);
    }

    console.log(`✓ Synced ${files.length} GIR files to ${girsDir}`);
};

const parseGirFile = (filePath: string): GirNamespace => {
    const girContent = readFileSync(filePath, "utf-8");
    const parser = new GirParser();
    return parser.parse(girContent);
};

const generateForNamespace = async (
    namespace: GirNamespace,
    typeRegistry: TypeRegistry,
): Promise<{ name: string; fileCount: number }> => {
    const generator = new CodeGenerator({ outputDir, namespace: namespace.name, typeRegistry });
    const generatedFiles = await generator.generateNamespace(namespace);

    const namespaceOutputDir = join(outputDir, namespace.name.toLowerCase());
    mkdirSync(namespaceOutputDir, { recursive: true });

    for (const [filename, content] of generatedFiles) {
        writeFileSync(join(namespaceOutputDir, filename), content);
    }

    return { name: namespace.name, fileCount: generatedFiles.size };
};

const generateBindings = async (): Promise<void> => {
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
    }

    if (!existsSync(girsDir)) {
        console.error(`Error: GIR directory not found: ${girsDir}`);
        console.error("Run with --sync flag to sync GIR files from system");
        process.exit(1);
    }

    const girFiles = readdirSync(girsDir)
        .filter((f) => f.endsWith(".gir"))
        .filter((f) => IMPORTANT_GIRS.has(f));

    console.log(`\nFound ${girFiles.length} GIR files in ${girsDir}`);

    console.log("\nParsing all GIR files to build type registry...");
    const namespaces: GirNamespace[] = [];
    for (const file of girFiles) {
        try {
            const namespace = parseGirFile(join(girsDir, file));
            namespaces.push(namespace);
            console.log(`  ✓ Parsed ${namespace.name}`);
        } catch (error) {
            console.error(`  ✗ Failed to parse ${file}:`, error);
        }
    }

    const typeRegistry = TypeRegistry.fromNamespaces(namespaces);
    console.log(`\nBuilt type registry with ${namespaces.length} namespaces`);

    console.log("\nGenerating bindings...");
    for (const namespace of namespaces) {
        try {
            const result = await generateForNamespace(namespace, typeRegistry);
            console.log(`  ✓ Generated ${result.fileCount} files for ${result.name}`);
        } catch (error) {
            console.error(`  ✗ Failed to generate ${namespace.name}:`, error);
        }
    }

    console.log("\n✓ Code generation complete!");
};

const main = async (): Promise<void> => {
    const shouldSync = process.argv.includes("--sync");

    if (shouldSync) {
        try {
            syncGirFiles();
        } catch (error) {
            console.error("Error syncing GIR files:", error);
            process.exit(1);
        }
    }

    try {
        await generateBindings();
    } catch (error) {
        console.error("Error in batch generation:", error);
        process.exit(1);
    }
};

await main();
