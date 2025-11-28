import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildClassMap, GirParser, registerEnumsFromNamespace, TypeMapper, TypeRegistry } from "@gtkx/gir";
import { JsxGenerator } from "../src/codegen/jsx-generator.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(__dirname, "../../..");
const girFile = join(workspaceRoot, "girs/Gtk-4.0.gir");
const outputDir = resolve(__dirname, "../src/generated");
const outputFile = resolve(outputDir, "jsx.ts");

const generateJsxTypes = async (): Promise<void> => {
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
    }

    console.log(`Reading GIR file: ${girFile}`);
    const girContent = readFileSync(girFile, "utf-8");

    const parser = new GirParser();
    const namespace = parser.parse(girContent);
    console.log(`Parsed namespace: ${namespace.name} v${namespace.version}`);

    if (namespace.name !== "Gtk" || !namespace.version.startsWith("4")) {
        throw new Error(`Expected Gtk 4.x namespace, got ${namespace.name} ${namespace.version}`);
    }

    const classMap = buildClassMap(namespace.classes);
    const typeRegistry = TypeRegistry.fromNamespaces([namespace]);
    const typeMapper = new TypeMapper();
    registerEnumsFromNamespace(typeMapper, namespace);
    typeMapper.setTypeRegistry(typeRegistry, namespace.name);
    const generator = new JsxGenerator(typeMapper);

    console.log(`Generating JSX type definitions...`);
    const content = await generator.generate(namespace, classMap);

    console.log(`Writing ${outputFile}`);
    writeFileSync(outputFile, content);

    console.log("✓ JSX type generation complete!");
};

const main = async (): Promise<void> => {
    try {
        await generateJsxTypes();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

await main();
