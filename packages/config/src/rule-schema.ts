export const RELATIONSHIP_NODE_ELEMENT = "__GTKX_RELATIONSHIP_NODE__";

export const RELATIONSHIP_KINDS = [
    "companion",
    "meta-object",
    "layout-child",
    "overlay",
    "tab-label",
    "widget-prop",
    "container-slot",
    "text-anchor",
    "text-paintable",
    "buffer-text",
    "label-text",
] as const;

export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

const RELATIONSHIP_KIND_SET: ReadonlySet<string> = new Set(RELATIONSHIP_KINDS);

export const isRelationshipKind = (value: unknown): value is RelationshipKind =>
    typeof value === "string" && RELATIONSHIP_KIND_SET.has(value);

export const COMPANION_KIND: RelationshipKind = "companion";

export const META_OBJECT_KIND: RelationshipKind = "meta-object";

export const LAYOUT_CHILD_KIND: RelationshipKind = "layout-child";

export const OVERLAY_KIND: RelationshipKind = "overlay";

export const TAB_LABEL_KIND: RelationshipKind = "tab-label";

export const WIDGET_PROP_KIND: RelationshipKind = "widget-prop";

export const CONTAINER_SLOT_KIND: RelationshipKind = "container-slot";

export const TEXT_ANCHOR_KIND: RelationshipKind = "text-anchor";

export const TEXT_PAINTABLE_KIND: RelationshipKind = "text-paintable";

export const BUFFER_TEXT_KIND: RelationshipKind = "buffer-text";

export const LABEL_TEXT_KIND: RelationshipKind = "label-text";

export type AttachShape =
    | "append"
    | "add"
    | "setContent"
    | "setChild"
    | "getChild"
    | "remove"
    | "reorderChildAfter"
    | "insertChildAfter"
    | "insert"
    | "getFirstChild";

export type AttachShapeTable = Record<string, AttachShape[]>;

type AddMethodArg = "widget" | "id" | "title" | "iconName";

export type AddMethodRule = {
    method: string;
    args: AddMethodArg[];
    requires: AddMethodArg[];
};

export type PageMetaSetter = {
    setter: string;
    prop: string;
    fallback?: unknown;
    whenPresent?: boolean;
};

export type OrderedInsertSpec = {
    collection: string;
    attach: string;
    detach: string;
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const ARG_REFS = ["child", "item", "value", "index", "sibling"] as const;

export type ArgRef = (typeof ARG_REFS)[number];

export type Arg =
    | ArgRef
    | { prop: string; or?: JsonValue }
    | { field: string; or?: JsonValue }
    | { literal: JsonValue };

export type Call = string | { method: string; args: Arg[] };

export type AttachRule = {
    kind: "attach";
    parent: string;
    child: string;
    slot?: string;
    add?: Call;
    remove?: Call;
    insert?: Call;
    reorder?: Call;
    autowrap?: string;
};

export type CompanionRule = {
    kind: "companion";
    element: string;
    parent: string;
    add?: Call;
    insert?: Call;
    remove?: Call;
    companion?: Call;
    setters?: Record<string, string>;
    aliases?: Record<string, string>;
    multi?: boolean;
};

export type LayoutChildRule = {
    kind: "layout-child";
    element: string;
    parent: string;
    layout: string;
};

export type RejectRule = {
    kind: "reject";
    parent: string;
    child: string;
    prop: string;
};

export type SkipRule = {
    kind: "skip";
    child: string;
};

export type RelationshipRule = AttachRule | CompanionRule | LayoutChildRule | RejectRule | SkipRule;

export type ListRule = {
    kind: "list";
    type: string;
    prop: string;
    clear: Call;
    add: Call;
};

export type KeyedListRule = {
    kind: "keyed-list";
    type: string;
    prop: string;
    add: Call;
    remove: Call;
    key?: string;
    setters?: Record<string, string>;
};

export type ValueRule = {
    kind: "value";
    type: string;
    prop: string;
    call: Call;
    or?: JsonValue;
    then?: string;
};

export type SelectionRule = {
    kind: "selection";
    type: string;
    prop: string;
    get: string;
    set: string;
    lookup?: string;
};

export type ControlledTextRule = {
    kind: "controlled-text";
    type: string;
    prop: string;
    get: string;
    set: string;
};

export type ReassertRule = {
    kind: "reassert";
    type: string;
    prop: string;
    set: Call;
};

export type WriteOnceListRule = {
    kind: "write-once-list";
    type: string;
    prop: string;
    add: Call;
};

export type SyntheticPropRule =
    | ListRule
    | KeyedListRule
    | ValueRule
    | SelectionRule
    | ControlledTextRule
    | ReassertRule
    | WriteOnceListRule;

export type GtkxRules = {
    relationships?: RelationshipRule[];
    syntheticProps?: SyntheticPropRule[];
};

export type ResolvedGtkxRules = {
    relationships: RelationshipRule[];
    syntheticProps: SyntheticPropRule[];
};

export const resolveGtkxRules = (rules: GtkxRules | undefined): ResolvedGtkxRules => ({
    relationships: rules?.relationships ?? [],
    syntheticProps: rules?.syntheticProps ?? [],
});

const ruleError = (path: string, message: string): Error => new Error(`gtkx.config.ts: \`${path}\` ${message}`);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): boolean => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return true;
    }
    if (Array.isArray(value)) return value.every(isJsonValue);
    if (isRecord(value)) return Object.values(value).every(isJsonValue);
    return false;
};

const ARG_REF_SET: Set<string> = new Set(ARG_REFS);

const requireRecord = (path: string, value: unknown, keys: string[]): Record<string, unknown> => {
    if (!isRecord(value)) throw ruleError(path, "must be an object");
    for (const key of Object.keys(value)) {
        if (!keys.includes(key)) {
            throw ruleError(`${path}.${key}`, `is not a recognized key (expected ${keys.join(", ")})`);
        }
    }
    return value;
};

const requireName = (path: string, value: unknown): string => {
    if (typeof value !== "string" || value.length === 0) throw ruleError(path, "must be a non-empty string");
    return value;
};

const requireJson = (path: string, value: unknown): void => {
    if (!isJsonValue(value)) throw ruleError(path, "must be a JSON-serializable value");
};

const validateArg = (path: string, value: unknown): void => {
    if (typeof value === "string") {
        if (!ARG_REF_SET.has(value)) throw ruleError(path, `has unknown reference "${value}"`);
        return;
    }
    if (!isRecord(value)) throw ruleError(path, "must be a reference name or an object");
    if ("prop" in value || "field" in value) {
        const key = "prop" in value ? "prop" : "field";
        requireRecord(path, value, [key, "or"]);
        requireName(`${path}.${key}`, value[key]);
        if ("or" in value) requireJson(`${path}.or`, value.or);
        return;
    }
    if ("literal" in value) {
        requireRecord(path, value, ["literal"]);
        requireJson(`${path}.literal`, value.literal);
        return;
    }
    throw ruleError(path, "must be one of: reference name, { prop }, { field }, { literal }");
};

const validateCall = (path: string, value: unknown): void => {
    if (typeof value === "string") {
        requireName(path, value);
        return;
    }
    const record = requireRecord(path, value, ["method", "args"]);
    requireName(`${path}.method`, record.method);
    if (!Array.isArray(record.args)) throw ruleError(`${path}.args`, "must be an array");
    record.args.forEach((arg, index) => validateArg(`${path}.args[${index}]`, arg));
};

const validateOptionalCall = (path: string, value: unknown): void => {
    if (value !== undefined) validateCall(path, value);
};

const validateSetters = (path: string, value: unknown): void => {
    if (value === undefined) return;
    if (!isRecord(value)) throw ruleError(path, "must be an object mapping prop names to method names");
    for (const [prop, method] of Object.entries(value)) requireName(`${path}.${prop}`, method);
};

const validateRelationshipRule = (path: string, value: unknown): void => {
    if (!isRecord(value)) throw ruleError(path, "must be an object");
    switch (value.kind) {
        case "attach":
            requireRecord(path, value, ["kind", "parent", "child", "slot", "add", "remove", "insert", "reorder", "autowrap"]);
            requireName(`${path}.parent`, value.parent);
            requireName(`${path}.child`, value.child);
            if (value.slot !== undefined) requireName(`${path}.slot`, value.slot);
            if (value.add === undefined && value.remove === undefined) {
                throw ruleError(path, "must define at least one of `add` or `remove`");
            }
            validateOptionalCall(`${path}.add`, value.add);
            validateOptionalCall(`${path}.remove`, value.remove);
            validateOptionalCall(`${path}.insert`, value.insert);
            validateOptionalCall(`${path}.reorder`, value.reorder);
            if (value.autowrap !== undefined) requireName(`${path}.autowrap`, value.autowrap);
            return;
        case "companion":
            requireRecord(path, value, [
                "kind",
                "element",
                "parent",
                "add",
                "insert",
                "remove",
                "companion",
                "setters",
                "aliases",
                "multi",
            ]);
            requireName(`${path}.element`, value.element);
            requireName(`${path}.parent`, value.parent);
            validateOptionalCall(`${path}.add`, value.add);
            validateOptionalCall(`${path}.insert`, value.insert);
            validateOptionalCall(`${path}.remove`, value.remove);
            validateOptionalCall(`${path}.companion`, value.companion);
            validateSetters(`${path}.setters`, value.setters);
            validateSetters(`${path}.aliases`, value.aliases);
            if (value.multi !== undefined && typeof value.multi !== "boolean") {
                throw ruleError(`${path}.multi`, "must be a boolean");
            }
            return;
        case "layout-child":
            requireRecord(path, value, ["kind", "element", "parent", "layout"]);
            requireName(`${path}.element`, value.element);
            requireName(`${path}.parent`, value.parent);
            requireName(`${path}.layout`, value.layout);
            return;
        case "reject":
            requireRecord(path, value, ["kind", "parent", "child", "prop"]);
            requireName(`${path}.parent`, value.parent);
            requireName(`${path}.child`, value.child);
            requireName(`${path}.prop`, value.prop);
            return;
        case "skip":
            requireRecord(path, value, ["kind", "child"]);
            requireName(`${path}.child`, value.child);
            return;
        default:
            throw ruleError(`${path}.kind`, "must be one of attach, companion, layout-child, reject, skip");
    }
};

const SYNTHETIC_KEYS: Record<string, string[]> = {
    list: ["clear", "add"],
    "keyed-list": ["add", "remove", "key", "setters"],
    value: ["call", "or", "then"],
    selection: ["get", "set", "lookup"],
    "controlled-text": ["get", "set"],
    reassert: ["set"],
    "write-once-list": ["add"],
};

const requireGetSet = (path: string, value: Record<string, unknown>): void => {
    requireName(`${path}.get`, value.get);
    requireName(`${path}.set`, value.set);
};

const validateSyntheticPropRule = (path: string, value: unknown): void => {
    if (!isRecord(value)) throw ruleError(path, "must be an object");
    const keys = typeof value.kind === "string" ? SYNTHETIC_KEYS[value.kind] : undefined;
    if (keys === undefined) {
        throw ruleError(`${path}.kind`, `must be one of ${Object.keys(SYNTHETIC_KEYS).join(", ")}`);
    }
    requireRecord(path, value, ["kind", "type", "prop", ...keys]);
    requireName(`${path}.type`, value.type);
    requireName(`${path}.prop`, value.prop);
    switch (value.kind) {
        case "list":
            validateCall(`${path}.clear`, value.clear);
            validateCall(`${path}.add`, value.add);
            return;
        case "keyed-list":
            validateCall(`${path}.add`, value.add);
            validateCall(`${path}.remove`, value.remove);
            if (value.key !== undefined) requireName(`${path}.key`, value.key);
            validateSetters(`${path}.setters`, value.setters);
            if (value.setters !== undefined && value.key === undefined) {
                throw ruleError(`${path}.setters`, "requires `key` to address items");
            }
            return;
        case "value":
            validateCall(`${path}.call`, value.call);
            if (value.or !== undefined) requireJson(`${path}.or`, value.or);
            if (value.then !== undefined) requireName(`${path}.then`, value.then);
            return;
        case "selection":
            requireGetSet(path, value);
            if (value.lookup !== undefined) requireName(`${path}.lookup`, value.lookup);
            return;
        case "controlled-text":
            requireGetSet(path, value);
            return;
        case "reassert":
            validateCall(`${path}.set`, value.set);
            return;
        default:
            validateCall(`${path}.add`, value.add);
            return;
    }
};

export const validateGtkxRules = (value: unknown, path = "rules"): void => {
    const record = requireRecord(path, value, ["relationships", "syntheticProps"]);
    if (record.relationships !== undefined) {
        if (!Array.isArray(record.relationships)) throw ruleError(`${path}.relationships`, "must be an array");
        record.relationships.forEach((rule, index) =>
            validateRelationshipRule(`${path}.relationships[${index}]`, rule),
        );
    }
    if (record.syntheticProps !== undefined) {
        if (!Array.isArray(record.syntheticProps)) throw ruleError(`${path}.syntheticProps`, "must be an array");
        record.syntheticProps.forEach((rule, index) =>
            validateSyntheticPropRule(`${path}.syntheticProps[${index}]`, rule),
        );
    }
};

export type RuleNode = {
    instance: object;
    props: Record<string, unknown>;
    slotTag: string | undefined;
};

export type RuleContext = {
    instanceIsA: (instance: object, typeName: string) => boolean;
};

export type RuleSet = {
    appendChild?: (parent: RuleNode, child: RuleNode, ctx: RuleContext) => void;
    removeChild?: (parent: RuleNode, child: RuleNode, ctx: RuleContext) => void;
    setProps?: (
        node: RuleNode,
        newProps: Record<string, unknown>,
        oldProps: Record<string, unknown> | null,
        ctx: RuleContext,
    ) => void;
};

export type RuleRegistry = Record<string, RuleSet>;
