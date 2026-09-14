import { createXmlParser, parseXmlFile } from "@gtkx/codegen/internal";
import { isRecord } from "@gtkx/utils";

type ParsedKey = {
    name: string;
    kind: string;
    summary: string | null;
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
type RawSchema = ParsedSchema & { extendsId: string | null };
type RawSchemaFile = { fileName: string; schemas: RawSchema[] };

type MergeContext = {
    byId: Map<string, RawSchema>;
    merged: Map<string, ParsedKey>;
    visited: Set<string>;
};

const MULTI_TAGS: Set<string> = new Set(["schema", "key"]);
const PARSER = createXmlParser({ trimValues: true, isArray: (name) => MULTI_TAGS.has(name) });

const attr = (node: RawNode, name: string): string | null => {
    const value = node[`@_${name}`];

    return typeof value === "string" ? value : null;
};

const text = (node: RawNode, name: string): string | null => {
    const value = node[name];

    return typeof value === "string" && value.length > 0 ? value : null;
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

const parseKey = (key: RawNode, fileName: string): ParsedKey => {
    const name = attr(key, "name");

    if (name === null) {
        throw new Error(`A <key> in ${fileName} has no name attribute`);
    }

    return { name, kind: keyKind(key, fileName), summary: text(key, "summary") };
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

const collectInheritedKeys = (context: MergeContext, current: RawSchema): void => {
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

const mergeInheritedKeys = (schema: RawSchema, byId: Map<string, RawSchema>): ParsedKey[] => {
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
    };
};

const createSchemaResolver = (files: RawSchemaFile[]): (file: RawSchemaFile) => ParsedSchemaFile => {
    const byId = new Map(files.flatMap((file) => file.schemas.map((schema) => [schema.id, schema] as const)));

    return (file) => ({
        fileName: file.fileName,
        schemas: file.schemas.map((schema) => ({
            id: schema.id,
            path: schema.path,
            keys: mergeInheritedKeys(schema, byId),
        })),
    });
};

export { parseSchemaFile, createSchemaResolver, type ParsedSchema, type ParsedSchemaFile };
