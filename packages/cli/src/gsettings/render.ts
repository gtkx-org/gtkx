import { toUpperFirst } from "@gtkx/utils";
import type { ParsedKey, ParsedSchema, ParsedSchemaFile } from "./parser.js";

const VARIANT_TS_TYPES: Readonly<Record<string, string>> = {
    b: "boolean",
    i: "number",
    u: "number",
    x: "number",
    t: "number",
    d: "number",
    s: "string",
    as: "string[]",
};

const VARIANT_FALLBACK_TS_TYPE = `import("@gtkx/gi/glib").Variant`;

const ENUM_KIND = "enum";
const FLAGS_KIND = "flags";

/**
 * Serializes `value` as a string literal safe to embed in generated source.
 *
 * `JSON.stringify` leaves the U+2028/U+2029 line separators raw — JSON
 * permits them, but inside generated code they must appear escaped — so they
 * are rewritten to their escape sequences.
 *
 * @param value - The string to serialize
 * @returns The escaped string literal, including quotes
 */
const toJsStringLiteral = (value: string): string =>
    JSON.stringify(value)
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");

const exportNameFor = (schemaId: string): string => schemaId.replaceAll(".", "_");

const unionOf = (values: readonly string[]): string => values.map(toJsStringLiteral).join(" | ");

const tsTypeForKey = (key: ParsedKey, file: ParsedSchemaFile): string => {
    if (key.enumId !== null) {
        const nicks = file.enums.get(key.enumId);
        return nicks !== undefined && nicks.length > 0 ? unionOf(nicks) : "string";
    }
    if (key.flagsId !== null) {
        const nicks = file.flags.get(key.flagsId);
        return nicks !== undefined && nicks.length > 0 ? `(${unionOf(nicks)})[]` : "string[]";
    }
    if (key.variantType === "s" && key.choices.length > 0) {
        return unionOf(key.choices);
    }
    return VARIANT_TS_TYPES[key.variantType ?? ""] ?? VARIANT_FALLBACK_TS_TYPE;
};

const runtimeKindForKey = (key: ParsedKey): string => {
    if (key.enumId !== null) return ENUM_KIND;
    if (key.flagsId !== null) return FLAGS_KIND;
    return key.variantType ?? "";
};

const runtimeKeysFor = (schema: ParsedSchema): string => {
    const entries = schema.keys.map(
        (key) => `${toJsStringLiteral(key.name)}: ${toJsStringLiteral(runtimeKindForKey(key))}`,
    );
    return `{ ${entries.join(", ")} }`;
};

/**
 * Renders the JavaScript source of the virtual module backing a
 * `.gschema.xml` import.
 *
 * Each schema becomes a named export (its ID with dots replaced by
 * underscores) holding a schema-reference object: `id`, the per-key dispatch
 * map `keys`, and either `path: null` for a fixed-path schema or an
 * `at(path)` binder for a relocatable one. The first schema is also the
 * default export.
 *
 * @param file - The parsed schema file
 * @returns The module source
 */
export const renderRuntimeModule = (file: ParsedSchemaFile): string => {
    const lines: string[] = [];
    file.schemas.forEach((schema, index) => {
        const keysName = `keys_${index}`;
        const id = toJsStringLiteral(schema.id);
        lines.push(`const ${keysName} = ${runtimeKeysFor(schema)};`);
        if (schema.path === null) {
            lines.push(
                `export const ${exportNameFor(schema.id)} = { id: ${id}, keys: ${keysName}, at: (path) => ({ id: ${id}, path, keys: ${keysName} }) };`,
            );
        } else {
            lines.push(`export const ${exportNameFor(schema.id)} = { id: ${id}, path: null, keys: ${keysName} };`);
        }
    });
    const first = file.schemas[0];
    if (first !== undefined) {
        lines.push(`export default ${exportNameFor(first.id)};`);
    }
    return lines.join("\n");
};

const sanitizeSummary = (summary: string): string => summary.replaceAll("*/", "*\\/");

const interfaceNameFor = (schemaId: string, usedNames: Set<string>): string => {
    const base = `${schemaId
        .split(/[^a-zA-Z0-9]+/)
        .filter((part) => part.length > 0)
        .map(toUpperFirst)
        .join("")}Keys`;
    let name = base;
    let suffix = 2;
    while (usedNames.has(name)) {
        name = `${base}${suffix}`;
        suffix += 1;
    }
    usedNames.add(name);
    return name;
};

const renderKeysType = (name: string, schema: ParsedSchema, file: ParsedSchemaFile): string[] => {
    const lines = [`    type ${name} = {`];
    for (const key of schema.keys) {
        if (key.summary !== null) {
            lines.push(`        /** ${sanitizeSummary(key.summary)} */`);
        }
        lines.push(`        ${toJsStringLiteral(key.name)}: ${tsTypeForKey(key, file)};`);
    }
    lines.push("    };");
    return lines;
};

const boundRefTypeLines = (interfaceName: string, indent: string): string[] => [
    `${indent}readonly id: string;`,
    `${indent}readonly path: string | null;`,
    `${indent}readonly keys: { readonly [P in keyof ${interfaceName}]: string };`,
    `${indent}readonly __keys__?: ${interfaceName};`,
];

const renderSchemaConst = (schema: ParsedSchema, interfaceName: string): string[] => {
    const exportName = exportNameFor(schema.id);
    if (schema.path !== null) {
        return [
            `    const ${exportName}: {`,
            `        readonly id: ${toJsStringLiteral(schema.id)};`,
            ...boundRefTypeLines(interfaceName, "        ").slice(1),
            "    };",
        ];
    }
    return [
        `    const ${exportName}: {`,
        `        readonly id: ${JSON.stringify(schema.id)};`,
        `        readonly keys: { readonly [P in keyof ${interfaceName}]: string };`,
        `        readonly __keys__?: ${interfaceName};`,
        "        at(path: string): {",
        ...boundRefTypeLines(interfaceName, "            "),
        "        };",
        "    };",
    ];
};

const renderFileModule = (file: ParsedSchemaFile, usedNames: Set<string>): string[] => {
    const lines = [`declare module "*/${file.fileName}" {`];
    const exportNames: string[] = [];
    file.schemas.forEach((schema, index) => {
        if (index > 0) lines.push("");
        const interfaceName = interfaceNameFor(schema.id, usedNames);
        lines.push(...renderKeysType(interfaceName, schema, file));
        lines.push("");
        lines.push(...renderSchemaConst(schema, interfaceName));
        exportNames.push(exportNameFor(schema.id));
    });
    if (exportNames.length > 0) {
        lines.push("");
        lines.push(`    export { ${exportNames.join(", ")} };`);
        lines.push(`    export default ${exportNames[0]};`);
    }
    lines.push("}");
    return lines;
};

const ENV_HEADER = [
    "/**",
    " * GSettings schema modules generated by GTKX from the project's",
    " * `.gschema.xml` files. Regenerated by `gtkx codegen`, `gtkx dev`, and",
    " * `gtkx build`; do not edit.",
    " */",
];

/**
 * Renders the project's generated `env.d.ts`: one ambient module declaration
 * per `.gschema.xml` file, keyed on the file's basename, with a typed key
 * interface and schema-reference export per schema.
 *
 * Enum and flags keys narrow to unions of their value nicks, string keys
 * with `<choices>` narrow to unions of the choice values, and keys whose
 * GVariant type has no native TypeScript mapping surface as `GLib.Variant`.
 *
 * @param files - The parsed schema files, in deterministic order
 * @returns The declaration file source
 */
export const renderEnvModule = (files: readonly ParsedSchemaFile[]): string => {
    const usedNames = new Set<string>();
    const blocks = files
        .filter((file) => file.schemas.length > 0)
        .map((file) => renderFileModule(file, usedNames).join("\n"));
    return `${[ENV_HEADER.join("\n"), ...blocks].join("\n\n")}\n`;
};
