import { GTKX_ENV_MODULE_HEADER, toUpperFirst } from "@gtkx/utils";
import type { ParsedKey, ParsedSchema, ParsedSchemaFile } from "./parser.js";

const VARIANT_TS_TYPES: Record<string, string> = {
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

const toJsStringLiteral = (value: string): string =>
    JSON.stringify(value).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");

const exportNameFor = (schemaId: string): string => schemaId.replaceAll(".", "_");

const unionOf = (values: string[]): string => values.map(toJsStringLiteral).join(" | ");

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
    `${indent}id: string;`,
    `${indent}path: string | null;`,
    `${indent}keys: { [P in keyof ${interfaceName}]: string };`,
    `${indent}__keys__?: ${interfaceName};`,
];

const renderSchemaConst = (schema: ParsedSchema, interfaceName: string): string[] => {
    const exportName = exportNameFor(schema.id);
    if (schema.path !== null) {
        return [
            `    const ${exportName}: {`,
            `        id: ${toJsStringLiteral(schema.id)};`,
            ...boundRefTypeLines(interfaceName, "        ").slice(1),
            "    };",
        ];
    }
    return [
        `    const ${exportName}: {`,
        `        id: ${JSON.stringify(schema.id)};`,
        `        keys: { [P in keyof ${interfaceName}]: string };`,
        `        __keys__?: ${interfaceName};`,
        "        at(path: string): {",
        ...boundRefTypeLines(interfaceName, "            "),
        "        };",
        "    };",
    ];
};

const renderFileModule = (file: ParsedSchemaFile, usedNames: Set<string>): string[] => {
    const lines = [`declare module "${file.fileName}" {`];
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

export const renderEnvModule = (files: ParsedSchemaFile[]): string => {
    const usedNames = new Set<string>();
    const blocks = files
        .filter((file) => file.schemas.length > 0)
        .map((file) => renderFileModule(file, usedNames).join("\n"));
    return `${[GTKX_ENV_MODULE_HEADER, ...blocks].join("\n\n")}\n`;
};
