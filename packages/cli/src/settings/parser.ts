import { createXmlParser, parseXmlFile } from "@gtkx/codegen/internal";
import { isRecord } from "@gtkx/utils";

type KeyValues = Record<string, number> | string[];

type ParsedKey = {
    name: string;
    kind: string;
    summary: string | null;
    values: KeyValues | null;
};

type ParsedSchema = {
    id: string;
    path: string | null;
    keys: ParsedKey[];
};

type ParsedSchemaFile = {
    fileName: string;
    schemas: ParsedSchema[];
};

type RawNode = Record<string, unknown>;
type SchemaDefinition = ParsedSchema & { extendsId: string | null };
type RawKey = Omit<ParsedKey, "values"> & { values: string | string[] | null };
type RawSchema = Omit<SchemaDefinition, "keys"> & { keys: RawKey[] };
type RawEnum = { id: string; kind: "enum" | "flags"; values: Record<string, number> };
type RawSchemaFile = { fileName: string; schemas: RawSchema[]; enums: RawEnum[] };

type MergeContext = {
    byId: Map<string, SchemaDefinition>;
    merged: Map<string, ParsedKey>;
    visited: Set<string>;
};

const MULTI_TAGS: Set<string> = new Set(["schema", "key", "enum", "flags", "value", "choice"]);
const PARSER = createXmlParser({ trimValues: false, isArray: (name) => MULTI_TAGS.has(name) });
const INTEGER_LITERAL = /^[+-]?(?:0[xX][\da-fA-F]+|0[0-7]*|[1-9]\d*)$/;
const MIN_ENUM_VALUE = -2_147_483_648;
const MAX_ENUM_VALUE = 2_147_483_647;
const MAX_FLAGS_VALUE = 4_294_967_295;

const rawAttr = (node: RawNode, name: string): string | null => {
    const value = node[`@_${name}`];

    return typeof value === "string" ? value : null;
};

const attr = (node: RawNode, name: string): string | null => rawAttr(node, name)?.trim() ?? null;

const text = (node: RawNode, name: string): string | null => {
    const value = node[name];

    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const elementNode = (value: unknown): RawNode => {
    if (!isRecord(value)) {
        throw new Error("A GSettings schema or key element has no attributes");
    }

    return value;
};

const children = (node: RawNode, name: string): RawNode[] => {
    const value = node[name];

    return Array.isArray(value) ? value.map((child) => elementNode(child)) : [];
};

const keyKind = (key: RawNode, fileName: string): string => {
    if (attr(key, "enum") !== null) {
        return "enum";
    }

    if (attr(key, "flags") !== null) {
        return "flags";
    }

    const type = attr(key, "type");

    if (type === null) {
        throw new Error(`A <key> in ${fileName} has no type, enum or flags attribute`);
    }

    return type;
};

const parseChoices = (key: RawNode): string[] | null => {
    if (!("choices" in key)) {
        return null;
    }

    return children(elementNode(key.choices), "choice").map((choice) => {
        const value = rawAttr(choice, "value");

        if (value === null) {
            throw new Error("A GSettings choice has no value attribute");
        }

        return value;
    });
};

const parseEnumNumber = (value: string, kind: "enum" | "flags"): number => {
    const magnitude = value.replace(/^[+-]/, "").replace(/^0(?=[0-7]+$)/, "0o");
    const numeric = Number(magnitude) * (value.startsWith("-") ? -1 : 1);
    const min = kind === "enum" ? MIN_ENUM_VALUE : 0;
    const max = kind === "enum" ? MAX_ENUM_VALUE : MAX_FLAGS_VALUE;

    if (!INTEGER_LITERAL.test(value) || numeric < min || numeric > max) {
        throw new Error(`Invalid GSettings ${kind} value ${JSON.stringify(value)}`);
    }

    return numeric;
};

const parseEnum = (node: RawNode, kind: "enum" | "flags"): RawEnum => {
    const id = attr(node, "id");

    if (id === null) {
        throw new Error(`A GSettings ${kind} has no id attribute`);
    }

    const values = Object.fromEntries(children(node, "value").map((item) => {
        const nick = rawAttr(item, "nick");
        const value = attr(item, "value");

        if (nick === null || value === null) {
            throw new Error(`A GSettings ${kind} value has no nick or value attribute`);
        }

        return [nick, parseEnumNumber(value, kind)];
    }));

    return { id, kind, values };
};

const parseKey = (key: RawNode, fileName: string): RawKey => {
    const name = attr(key, "name");

    if (name === null) {
        throw new Error(`A <key> in ${fileName} has no name attribute`);
    }

    return {
        name,
        kind: keyKind(key, fileName),
        summary: text(key, "summary"),
        values: attr(key, "enum") ?? attr(key, "flags") ?? parseChoices(key),
    };
};

const parseRawSchema = (schema: RawNode, fileName: string): RawSchema => {
    const id = attr(schema, "id");

    if (id === null) {
        throw new Error(`A <schema> in ${fileName} has no id attribute`);
    }

    return {
        id,
        path: attr(schema, "path"),
        extendsId: attr(schema, "extends"),
        keys: children(schema, "key").map((key) => parseKey(key, fileName)),
    };
};

const collectInheritedKeys = (context: MergeContext, current: SchemaDefinition): void => {
    if (context.visited.has(current.id)) {
        throw new Error(`GSettings schema inheritance contains a cycle at ${current.id}`);
    }

    context.visited.add(current.id);

    if (current.extendsId !== null) {
        const parent = context.byId.get(current.extendsId);

        if (parent === undefined) {
            throw new Error(`GSettings schema ${current.id} extends missing schema ${current.extendsId}`);
        }

        collectInheritedKeys(context, parent);
    }

    for (const key of current.keys) {
        context.merged.set(key.name, key);
    }
};

const mergeInheritedKeys = (schema: SchemaDefinition, byId: Map<string, SchemaDefinition>): ParsedKey[] => {
    const context: MergeContext = { byId, merged: new Map(), visited: new Set() };
    collectInheritedKeys(context, schema);

    return context.merged.values().toArray();
};

const parseSchemaFile = (path: string, fileName: string): RawSchemaFile => {
    const document = parseXmlFile({ parser: PARSER, label: "GSettings schema", path });

    if (!isRecord(document) || !("schemalist" in document)) {
        throw new Error(`${fileName} has no <schemalist> root element`);
    }

    const schemalist = isRecord(document.schemalist) ? document.schemalist : {};

    return {
        fileName,
        schemas: children(schemalist, "schema").map((schema) => parseRawSchema(schema, fileName)),
        enums: [
            ...children(schemalist, "enum").map((node) => parseEnum(node, "enum")),
            ...children(schemalist, "flags").map((node) => parseEnum(node, "flags")),
        ],
    };
};

const resolveKeyValues = (key: RawKey, enums: Map<string, Record<string, number>>): ParsedKey => {
    if (typeof key.values !== "string") {
        return { ...key, values: key.values };
    }

    const values = enums.get(`${key.kind}:${key.values}`);

    if (values === undefined) {
        throw new Error(`GSettings key ${key.name} references missing ${key.kind} ${key.values}`);
    }

    return { ...key, values };
};

const createSchemaResolver = (files: RawSchemaFile[]): (file: RawSchemaFile) => ParsedSchemaFile => {
    const enums = new Map(files.flatMap((file) =>
        file.enums.map(({ id, kind, values }) => [`${kind}:${id}`, values] as const)));
    const resolveSchema = (schema: RawSchema): SchemaDefinition => ({
        ...schema,
        keys: schema.keys.map((key) => resolveKeyValues(key, enums)),
    });
    const byId = new Map(files.flatMap((file) => file.schemas.map((schema) => [schema.id, resolveSchema(schema)])));

    return (file) => ({
        fileName: file.fileName,
        schemas: file.schemas.map((schema) => ({
            id: schema.id,
            path: schema.path,
            keys: mergeInheritedKeys(resolveSchema(schema), byId),
        })),
    });
};

export { parseSchemaFile, createSchemaResolver, type ParsedSchema, type ParsedSchemaFile };
