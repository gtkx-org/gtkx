import { XMLParser } from "fast-xml-parser";

/**
 * A single `<key>` of a GSettings schema, with the attributes and child
 * elements that drive type generation.
 */
export type ParsedKey = {
    /** The key name in kebab-case (the `name` attribute). */
    readonly name: string;
    /** The GVariant type string (the `type` attribute), or `null` for enum/flags keys. */
    readonly variantType: string | null;
    /** The referenced `<enum>` definition ID (the `enum` attribute), or `null`. */
    readonly enumId: string | null;
    /** The referenced `<flags>` definition ID (the `flags` attribute), or `null`. */
    readonly flagsId: string | null;
    /** Values of a `<choices>` restriction, empty when the key has none. */
    readonly choices: readonly string[];
    /** The `<summary>` text, or `null` when absent. */
    readonly summary: string | null;
};

/**
 * A single `<schema>` element with its effective key set.
 */
export type ParsedSchema = {
    /** The schema ID (the `id` attribute). */
    readonly id: string;
    /** The fixed schema path, or `null` for a relocatable schema. */
    readonly path: string | null;
    /** The effective keys: inherited keys from `extends` chains within the file, then own keys. */
    readonly keys: readonly ParsedKey[];
};

/**
 * The parsed content of one `.gschema.xml` file.
 */
export type ParsedSchemaFile = {
    /** The file's basename (e.g. `com.example.notes.gschema.xml`). */
    readonly fileName: string;
    /** Every `<schema>` element, in document order. */
    readonly schemas: readonly ParsedSchema[];
    /** `<enum>` definitions: ID to value nicks, in document order. */
    readonly enums: ReadonlyMap<string, readonly string[]>;
    /** `<flags>` definitions: ID to value nicks, in document order. */
    readonly flags: ReadonlyMap<string, readonly string[]>;
};

/**
 * Raised when a `.gschema.xml` file cannot be interpreted as a GSettings
 * schema list.
 */
export class SchemaParseError extends Error {}

type RawNode = Record<string, unknown>;

const MULTI_TAGS: ReadonlySet<string> = new Set(["schema", "key", "enum", "flags", "value", "choice"]);

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

const parseDefinitions = (schemalist: RawNode, tag: string): Map<string, readonly string[]> => {
    const definitions = new Map<string, readonly string[]>();
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
    readonly id: string;
    readonly path: string | null;
    readonly extendsId: string | null;
    readonly keys: readonly ParsedKey[];
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

const mergeInheritedKeys = (schema: RawSchema, byId: ReadonlyMap<string, RawSchema>): readonly ParsedKey[] => {
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

/**
 * Parses the XML source of a `.gschema.xml` file into its schemas, enum and
 * flags definitions, and per-schema effective key sets.
 *
 * `extends` chains are resolved within the file: an extending schema's key
 * set includes the keys of every ancestor declared in the same file, with
 * its own declarations taking precedence on name conflicts. Parents declared
 * in other files are not resolved.
 *
 * @param xml - The file's XML source
 * @param fileName - The file's basename, used in error messages and module patterns
 * @returns The {@link ParsedSchemaFile}
 * @throws SchemaParseError when the source has no `<schemalist>` or a schema/key lacks its identifying attribute
 */
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
