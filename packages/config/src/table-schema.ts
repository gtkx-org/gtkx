export type VerbArgs = "child" | "childName" | "null" | "prefixChild" | "prefixNull";

export type MethodVerb = {
    kind: "method";
    attach: string;
    attachArgs: VerbArgs;
    detach: string;
    detachArgs: VerbArgs;
    detachGuard?: { side: "child" | "parent"; getter: string };
};

export type OrderedInsertVerb = {
    kind: "orderedInsert";
    attach: string;
    detach: string;
    collection: string;
};

export type AttachVerb = MethodVerb | OrderedInsertVerb;

export type ElementMapRule = {
    child: string;
    parentType?: string;
    parentMethod?: string;
    verb: AttachVerb;
};

export type PresenceCondition = "defined" | "nonNull";

export type CallArg = { kind: "item"; path?: string; fallback?: unknown } | { kind: "value"; value: unknown };

export type CallStep = {
    method: string;
    args: CallArg[];
    when?: { path: string; is: PresenceCondition };
};

export type ConstructSetter = {
    method: string;
    path: string;
    when: PresenceCondition;
};

export type ConstructStep = {
    type: string;
    setters: ConstructSetter[];
    attach: string;
};

export type ArrayPropRow = {
    itemType: string;
    clear?: string;
    remove?: CallStep;
    add?: CallStep[];
    construct?: ConstructStep;
    set?: string;
    appendOnce?: boolean;
};

export type ObjectPropRow = {
    itemType: string;
    set: CallStep[];
    unset?: CallStep[];
};

export type VirtualPropRow = {
    type: string;
    setter: string;
    after?: string;
};

export type PropCondition = "defined" | "nonNull" | "truthy";

export type SetterPropStep = {
    prop: string;
    call?: string;
    set?: string;
    when?: PropCondition;
    skipWhenGetterEquals?: string;
    requireGetterTruthyWithValue?: string;
    skipWhenGetterDivergedFromCommitted?: string;
};

export type SetterPropGroup = {
    kind: "setters";
    props: SetterPropStep[];
    always?: boolean;
};

export type SignalPropRule = {
    kind: "signal";
    prop: string;
    signal: string;
    noArgs?: boolean;
    returnValue?: unknown;
};

export type PropRule = SetterPropGroup | SignalPropRule;

export type AddMethodArg = "widget" | "id" | "title" | "iconName";

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

export type PerElementPropRows<Row> = Record<string, Record<string, Row>>;

export type UserTableRows = {
    containerProps?: Record<string, string[]> | undefined;

    arrayProps?: PerElementPropRows<ArrayPropRow> | undefined;

    objectProps?: PerElementPropRows<ObjectPropRow> | undefined;

    virtualProps?: PerElementPropRows<VirtualPropRow> | undefined;

    elementMap?: ElementMapRule[] | undefined;
};

const GLIB_TYPE_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
const METHOD_NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const VERB_ARGS: VerbArgs[] = ["child", "childName", "null", "prefixChild", "prefixNull"];
const PRESENCE_CONDITIONS: PresenceCondition[] = ["defined", "nonNull"];

const fail = (path: string, message: string): never => {
    throw new Error(`gtkx.config.ts: invalid \`${path}\` — ${message}`);
};

const requireRecord = (value: unknown, path: string): Record<string, unknown> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        fail(path, "must be an object");
    }
    return value as Record<string, unknown>;
};

const requireTypeName = (value: unknown, path: string): void => {
    if (typeof value !== "string" || !GLIB_TYPE_NAME_PATTERN.test(value)) {
        fail(path, `must be a PascalCase GLib type name (e.g. "GtkWidget"), got "${String(value)}"`);
    }
};

const requireMethodName = (value: unknown, path: string): void => {
    if (typeof value !== "string" || !METHOD_NAME_PATTERN.test(value)) {
        fail(path, `must be a camelCase method name (e.g. "addController"), got "${String(value)}"`);
    }
};

const requireFieldName = (value: unknown, path: string): void => {
    if (typeof value !== "string" || !METHOD_NAME_PATTERN.test(value)) {
        fail(path, `must be a camelCase item field name (e.g. "iconName"), got "${String(value)}"`);
    }
};

const validateMethodVerb = (verb: Record<string, unknown>, path: string): void => {
    requireMethodName(verb["attach"], `${path}.attach`);
    requireMethodName(verb["detach"], `${path}.detach`);
    for (const key of ["attachArgs", "detachArgs"] as const) {
        if (!VERB_ARGS.includes(verb[key] as VerbArgs)) {
            fail(`${path}.${key}`, `must be one of ${VERB_ARGS.join(", ")}`);
        }
    }
    if (verb["detachGuard"] !== undefined) {
        const guard = requireRecord(verb["detachGuard"], `${path}.detachGuard`);
        if (guard["side"] !== "child" && guard["side"] !== "parent") {
            fail(`${path}.detachGuard.side`, 'must be "child" or "parent"');
        }
        requireMethodName(guard["getter"], `${path}.detachGuard.getter`);
    }
};

const validateOrderedInsertVerb = (verb: Record<string, unknown>, path: string): void => {
    requireMethodName(verb["attach"], `${path}.attach`);
    requireMethodName(verb["detach"], `${path}.detach`);
    requireMethodName(verb["collection"], `${path}.collection`);
};

const validateVerb = (value: unknown, path: string): void => {
    const verb = requireRecord(value, path);
    if (verb["kind"] === "method") validateMethodVerb(verb, path);
    else if (verb["kind"] === "orderedInsert") validateOrderedInsertVerb(verb, path);
    else fail(`${path}.kind`, 'must be "method" or "orderedInsert"');
};

export const validateElementMap = (elementMap: unknown): void => {
    if (elementMap === undefined) return;
    if (!Array.isArray(elementMap)) fail("elementMap", "must be an array of attach rules");
    (elementMap as unknown[]).forEach((value, index) => {
        const path = `elementMap[${index}]`;
        const rule = requireRecord(value, path);
        requireTypeName(rule["child"], `${path}.child`);
        if (rule["parentType"] === undefined && rule["parentMethod"] === undefined) {
            fail(path, "must declare `parentType` or `parentMethod`");
        }
        if (rule["parentType"] !== undefined) requireTypeName(rule["parentType"], `${path}.parentType`);
        if (rule["parentMethod"] !== undefined) requireMethodName(rule["parentMethod"], `${path}.parentMethod`);
        validateVerb(rule["verb"], `${path}.verb`);
    });
};

const validateWhen = (when: unknown, path: string): void => {
    if (when === undefined) return;
    const condition = requireRecord(when, path);
    requireFieldName(condition["path"], `${path}.path`);
    if (!PRESENCE_CONDITIONS.includes(condition["is"] as PresenceCondition)) {
        fail(`${path}.is`, `must be one of ${PRESENCE_CONDITIONS.join(", ")}`);
    }
};

const validateCallArg = (value: unknown, path: string): void => {
    const arg = requireRecord(value, path);
    if (arg["kind"] === "item") {
        if (arg["path"] !== undefined) requireFieldName(arg["path"], `${path}.path`);
        return;
    }
    if (arg["kind"] !== "value") fail(`${path}.kind`, 'must be "item" or "value"');
};

const validateCallStep = (value: unknown, path: string): void => {
    const step = requireRecord(value, path);
    requireMethodName(step["method"], `${path}.method`);
    if (!Array.isArray(step["args"])) fail(`${path}.args`, "must be an array");
    (step["args"] as unknown[]).forEach((arg, index) => {
        validateCallArg(arg, `${path}.args[${index}]`);
    });
    validateWhen(step["when"], `${path}.when`);
};

const validateConstructStep = (value: unknown, path: string): void => {
    const step = requireRecord(value, path);
    requireTypeName(step["type"], `${path}.type`);
    requireMethodName(step["attach"], `${path}.attach`);
    if (!Array.isArray(step["setters"])) fail(`${path}.setters`, "must be an array");
    (step["setters"] as unknown[]).forEach((setter, index) => {
        const setterPath = `${path}.setters[${index}]`;
        const record = requireRecord(setter, setterPath);
        requireMethodName(record["method"], `${setterPath}.method`);
        requireFieldName(record["path"], `${setterPath}.path`);
        if (!PRESENCE_CONDITIONS.includes(record["when"] as PresenceCondition)) {
            fail(`${setterPath}.when`, `must be one of ${PRESENCE_CONDITIONS.join(", ")}`);
        }
    });
};

const ITEM_TYPE_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

const validateArrayPropRow = (value: unknown, path: string): void => {
    const row = requireRecord(value, path);
    if (typeof row["itemType"] !== "string" || !ITEM_TYPE_NAME_PATTERN.test(row["itemType"])) {
        fail(`${path}.itemType`, `must be a PascalCase exported member of @gtkx/react (e.g. "ScaleMark")`);
    }
    if (row["clear"] !== undefined) requireMethodName(row["clear"], `${path}.clear`);
    if (row["set"] !== undefined) requireMethodName(row["set"], `${path}.set`);
    if (row["appendOnce"] !== undefined && typeof row["appendOnce"] !== "boolean") {
        fail(`${path}.appendOnce`, "must be a boolean");
    }
    if (row["remove"] !== undefined) validateCallStep(row["remove"], `${path}.remove`);
    if (row["add"] !== undefined) {
        if (!Array.isArray(row["add"])) fail(`${path}.add`, "must be an array of call steps");
        (row["add"] as unknown[]).forEach((step, index) => {
            validateCallStep(step, `${path}.add[${index}]`);
        });
    }
    if (row["construct"] !== undefined) validateConstructStep(row["construct"], `${path}.construct`);
};

export const validateArrayPropRows = (arrayProps: unknown): void => {
    validatePropRowMap(arrayProps, "arrayProps", validateArrayPropRow);
};

const validateObjectPropRow = (value: unknown, path: string): void => {
    const row = requireRecord(value, path);
    if (typeof row["itemType"] !== "string" || !ITEM_TYPE_NAME_PATTERN.test(row["itemType"])) {
        fail(`${path}.itemType`, `must be a PascalCase exported member of @gtkx/react (e.g. "DragSourceIcon")`);
    }
    if (!Array.isArray(row["set"])) fail(`${path}.set`, "must be an array of call steps");
    (row["set"] as unknown[]).forEach((step, index) => {
        validateCallStep(step, `${path}.set[${index}]`);
    });
    if (row["unset"] !== undefined) {
        if (!Array.isArray(row["unset"])) fail(`${path}.unset`, "must be an array of call steps");
        (row["unset"] as unknown[]).forEach((step, index) => {
            validateCallStep(step, `${path}.unset[${index}]`);
        });
    }
};

export const validateObjectPropRows = (objectProps: unknown): void => {
    validatePropRowMap(objectProps, "objectProps", validateObjectPropRow);
};

const QUALIFIED_TYPE_PATTERN = /^[A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9]*$/;

const validateVirtualPropRow = (value: unknown, path: string): void => {
    const row = requireRecord(value, path);
    if (typeof row["type"] !== "string" || !QUALIFIED_TYPE_PATTERN.test(row["type"])) {
        fail(`${path}.type`, `must be a qualified GIR type (e.g. "Gtk.DrawingAreaDrawFunc")`);
    }
    requireMethodName(row["setter"], `${path}.setter`);
    if (row["after"] !== undefined) requireMethodName(row["after"], `${path}.after`);
};

export const validateVirtualPropRows = (virtualProps: unknown): void => {
    validatePropRowMap(virtualProps, "virtualProps", validateVirtualPropRow);
};

const validatePropRowMap = (
    value: unknown,
    tableName: string,
    validateRow: (row: unknown, path: string) => void,
): void => {
    if (value === undefined) return;
    const map = requireRecord(value, tableName);
    for (const [jsxName, props] of Object.entries(map)) {
        requireTypeName(jsxName, `${tableName} key "${jsxName}"`);
        const propMap = requireRecord(props, `${tableName}.${jsxName}`);
        if (Object.keys(propMap).length === 0) {
            fail(`${tableName}.${jsxName}`, "must declare at least one prop");
        }
        for (const [propName, row] of Object.entries(propMap)) {
            requireMethodName(propName, `${tableName}.${jsxName} prop "${propName}"`);
            validateRow(row, `${tableName}.${jsxName}.${propName}`);
        }
    }
};
