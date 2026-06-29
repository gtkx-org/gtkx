import { XMLParser } from "fast-xml-parser";

export type ParsedKey = {
    name: string;
    variantType: string | null;
    enumId: string | null;
    flagsId: string | null;
    choices: string[];
    summary: string | null;
};

export type ParsedSchema = {
    id: string;
    path: string | null;
    keys: ParsedKey[];
};

export type ParsedSchemaFile = {
    fileName: string;
    schemas: ParsedSchema[];
    enums: Map<string, string[]>;
    flags: Map<string, string[]>;
};

export class SchemaParseError extends Error {}

type RawNode = Record<string, unknown>;

const MULTI_TAGS: Set<string> = new Set(["schema", "key", "enum", "flags", "value", "choice"]);

const PARSER = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    isArray: (name) => MULTI_TAGS.has(name),
});

const isRawNode = (value: unknown): value is RawNode => typeof value === "object" && value !== null;

const attr = (node: RawNode, name: string): string | null => {
    const value = node[`@_${name}`];
    return typeof value === "string" ? value : null;
};

const text = (node: RawNode, name: string): string | null => {
    const value = node[name];
    return typeof value === "string" && value.length > 0 ? value : null;
};

const children = (node: RawNode, name: string): RawNode[] => {
    const value = node[name];
    if (!Array.isArray(value)) return [];
    return value.filter(isRawNode);
};

const parseNicks = (definition: RawNode): string[] =>
    children(definition, "value")
        .map((value) => attr(value, "nick"))
        .filter((nick): nick is string => nick !== null);

const parseDefinitions = (schemalist: RawNode, tag: string): Map<string, string[]> => {
    const definitions = new Map<string, string[]>();
    for (const definition of children(schemalist, tag)) {
        const id = attr(definition, "id");
        if (id !== null) definitions.set(id, parseNicks(definition));
    }
    return definitions;
};

const parseChoices = (key: RawNode): string[] => {
    const choices = key.choices;
    if (!isRawNode(choices)) return [];
    return children(choices, "choice")
        .map((choice) => attr(choice, "value"))
        .filter((value): value is string => value !== null);
};

const parseKey = (key: RawNode, fileName: string): ParsedKey => {
    const name = attr(key, "name");
    if (name === null) {
        throw new SchemaParseError(`A <key> in ${fileName} has no name attribute`);
    }
    return {
        name,
        variantType: attr(key, "type"),
        enumId: attr(key, "enum"),
        flagsId: attr(key, "flags"),
        choices: parseChoices(key),
        summary: text(key, "summary"),
    };
};

type RawSchema = {
    id: string;
    path: string | null;
    extendsId: string | null;
    keys: ParsedKey[];
};

const parseRawSchema = (schema: RawNode, fileName: string): RawSchema => {
    const id = attr(schema, "id");
    if (id === null) {
        throw new SchemaParseError(`A <schema> in ${fileName} has no id attribute`);
    }
    return {
        id,
        path: attr(schema, "path"),
        extendsId: attr(schema, "extends"),
        keys: children(schema, "key").map((key) => parseKey(key, fileName)),
    };
};

const mergeInheritedKeys = (schema: RawSchema, byId: Map<string, RawSchema>): ParsedKey[] => {
    const merged = new Map<string, ParsedKey>();
    const visited = new Set<string>();
    const collect = (current: RawSchema): void => {
        if (visited.has(current.id)) return;
        visited.add(current.id);
        if (current.extendsId !== null) {
            const parent = byId.get(current.extendsId);
            if (parent !== undefined) collect(parent);
        }
        for (const key of current.keys) merged.set(key.name, key);
    };
    collect(schema);
    return [...merged.values()];
};

export const parseSchemaXml = (xml: string, fileName: string): ParsedSchemaFile => {
    let document: unknown;
    try {
        document = PARSER.parse(xml);
    } catch (error) {
        throw new SchemaParseError(`Failed to parse ${fileName} as XML: ${String(error)}`, { cause: error });
    }
    if (!isRawNode(document) || !("schemalist" in document)) {
        throw new SchemaParseError(`${fileName} has no <schemalist> root element`);
    }
    const schemalist = isRawNode(document.schemalist) ? document.schemalist : {};
    const rawSchemas = children(schemalist, "schema").map((schema) => parseRawSchema(schema, fileName));
    const byId = new Map(rawSchemas.map((schema) => [schema.id, schema]));
    return {
        fileName,
        schemas: rawSchemas.map((schema) => ({
            id: schema.id,
            path: schema.path,
            keys: mergeInheritedKeys(schema, byId),
        })),
        enums: parseDefinitions(schemalist, "enum"),
        flags: parseDefinitions(schemalist, "flags"),
    };
};
