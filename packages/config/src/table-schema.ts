import { CAMEL_CASE_NAME_PATTERN, PASCAL_CASE_NAME_PATTERN, validateArrayOf } from "./validators.js";

export type VerbArgs = "child" | "childName" | "null" | "prefixChild" | "prefixNull";

export type DetachGuard = { side: "child" | "parent"; getter: string };

export type MethodVerb = {
    kind: "method";
    attach: string;
    attachArgs: VerbArgs;
    detach: string;
    detachArgs: VerbArgs;
    detachGuard?: DetachGuard;
};

export type ContainerPropRow = {
    attach: string;
    attachArgs?: VerbArgs;
    detach?: string;
    detachArgs?: VerbArgs;
    detachGuard?: DetachGuard;
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

export type PerElementPropRows<Row> = Record<string, Record<string, Row>>;

/**
 * Names of the child-attachment method shapes a GObject type can satisfy. Each
 * shape corresponds to a runtime method whose presence *and* signature (argument
 * arity, parameter types, nullability) `@gtkx/codegen` verifies against the GIR
 * model, so the reconciler can rely on the call shape instead of duck-typing the
 * method name alone.
 */
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

/**
 * Maps a GLib type name to the verified {@link AttachShape}s its own methods
 * introduce. The reconciler resolves an instance's full shape set by unioning
 * the entries across its type-name chain and implemented interfaces.
 */
export type AttachShapeTable = Record<string, AttachShape[]>;

export type UserTableRows = {
    containerProps?: PerElementPropRows<ContainerPropRow> | undefined;

    arrayProps?: PerElementPropRows<ArrayPropRow> | undefined;

    objectProps?: PerElementPropRows<ObjectPropRow> | undefined;

    virtualProps?: PerElementPropRows<VirtualPropRow> | undefined;

    elementMap?: ElementMapRule[] | undefined;
};

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
    if (typeof value !== "string" || !PASCAL_CASE_NAME_PATTERN.test(value)) {
        fail(path, `must be a PascalCase GLib type name (e.g. "GtkWidget"), got "${String(value)}"`);
    }
};

const requireMethodName = (value: unknown, path: string): void => {
    if (typeof value !== "string" || !CAMEL_CASE_NAME_PATTERN.test(value)) {
        fail(path, `must be a camelCase method name (e.g. "addController"), got "${String(value)}"`);
    }
};

const requireFieldName = (value: unknown, path: string): void => {
    if (typeof value !== "string" || !CAMEL_CASE_NAME_PATTERN.test(value)) {
        fail(path, `must be a camelCase item field name (e.g. "iconName"), got "${String(value)}"`);
    }
};

const requireReactMemberName = (value: unknown, path: string, example: string): void => {
    if (typeof value !== "string" || !PASCAL_CASE_NAME_PATTERN.test(value)) {
        fail(path, `must be a PascalCase exported member of @gtkx/react (e.g. "${example}")`);
    }
};

const validateVerbArgs = (value: unknown, path: string): void => {
    if (!VERB_ARGS.includes(value as VerbArgs)) {
        fail(path, `must be one of ${VERB_ARGS.join(", ")}`);
    }
};

const validateDetachGuard = (value: unknown, path: string): void => {
    const guard = requireRecord(value, path);
    if (guard["side"] !== "child" && guard["side"] !== "parent") {
        fail(`${path}.side`, 'must be "child" or "parent"');
    }
    requireMethodName(guard["getter"], `${path}.getter`);
};

const validateMethodVerb = (verb: Record<string, unknown>, path: string): void => {
    requireMethodName(verb["attach"], `${path}.attach`);
    requireMethodName(verb["detach"], `${path}.detach`);
    validateVerbArgs(verb["attachArgs"], `${path}.attachArgs`);
    validateVerbArgs(verb["detachArgs"], `${path}.detachArgs`);
    if (verb["detachGuard"] !== undefined) validateDetachGuard(verb["detachGuard"], `${path}.detachGuard`);
};

const validateContainerPropRow = (value: unknown, path: string): void => {
    const row = requireRecord(value, path);
    requireMethodName(row["attach"], `${path}.attach`);
    if (row["attachArgs"] !== undefined) validateVerbArgs(row["attachArgs"], `${path}.attachArgs`);
    if (row["detach"] !== undefined) requireMethodName(row["detach"], `${path}.detach`);
    if (row["detachArgs"] !== undefined) validateVerbArgs(row["detachArgs"], `${path}.detachArgs`);
    if (row["detachGuard"] !== undefined) validateDetachGuard(row["detachGuard"], `${path}.detachGuard`);
};

export const validateContainerPropRows = (containerProps: unknown): void => {
    validatePropRowMap(containerProps, "containerProps", validateContainerPropRow);
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

const validateElementMapRule = (value: unknown, path: string): void => {
    const rule = requireRecord(value, path);
    requireTypeName(rule["child"], `${path}.child`);
    if (rule["parentType"] === undefined && rule["parentMethod"] === undefined) {
        fail(path, "must declare `parentType` or `parentMethod`");
    }
    if (rule["parentType"] !== undefined) requireTypeName(rule["parentType"], `${path}.parentType`);
    if (rule["parentMethod"] !== undefined) requireMethodName(rule["parentMethod"], `${path}.parentMethod`);
    validateVerb(rule["verb"], `${path}.verb`);
};

export const validateElementMap = (elementMap: unknown): void => {
    if (elementMap === undefined) return;
    validateArrayOf(elementMap, "elementMap", validateElementMapRule, (path) =>
        fail(path, "must be an array of attach rules"),
    );
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
    validateArrayOf(step["args"], `${path}.args`, validateCallArg, (argsPath) => fail(argsPath, "must be an array"));
    validateWhen(step["when"], `${path}.when`);
};

const validateConstructSetter = (setter: unknown, setterPath: string): void => {
    const record = requireRecord(setter, setterPath);
    requireMethodName(record["method"], `${setterPath}.method`);
    requireFieldName(record["path"], `${setterPath}.path`);
    if (!PRESENCE_CONDITIONS.includes(record["when"] as PresenceCondition)) {
        fail(`${setterPath}.when`, `must be one of ${PRESENCE_CONDITIONS.join(", ")}`);
    }
};

const validateConstructStep = (value: unknown, path: string): void => {
    const step = requireRecord(value, path);
    requireTypeName(step["type"], `${path}.type`);
    requireMethodName(step["attach"], `${path}.attach`);
    validateArrayOf(step["setters"], `${path}.setters`, validateConstructSetter, (settersPath) =>
        fail(settersPath, "must be an array"),
    );
};

const validateArrayPropRow = (value: unknown, path: string): void => {
    const row = requireRecord(value, path);
    requireReactMemberName(row["itemType"], `${path}.itemType`, "ScaleMark");
    if (row["clear"] !== undefined) requireMethodName(row["clear"], `${path}.clear`);
    if (row["set"] !== undefined) requireMethodName(row["set"], `${path}.set`);
    if (row["appendOnce"] !== undefined && typeof row["appendOnce"] !== "boolean") {
        fail(`${path}.appendOnce`, "must be a boolean");
    }
    if (row["remove"] !== undefined) validateCallStep(row["remove"], `${path}.remove`);
    if (row["add"] !== undefined) {
        validateArrayOf(row["add"], `${path}.add`, validateCallStep, (addPath) =>
            fail(addPath, "must be an array of call steps"),
        );
    }
    if (row["construct"] !== undefined) validateConstructStep(row["construct"], `${path}.construct`);
};

export const validateArrayPropRows = (arrayProps: unknown): void => {
    validatePropRowMap(arrayProps, "arrayProps", validateArrayPropRow);
};

const validateObjectPropRow = (value: unknown, path: string): void => {
    const row = requireRecord(value, path);
    requireReactMemberName(row["itemType"], `${path}.itemType`, "DragSourceIcon");
    validateArrayOf(row["set"], `${path}.set`, validateCallStep, (setPath) =>
        fail(setPath, "must be an array of call steps"),
    );
    if (row["unset"] !== undefined) {
        validateArrayOf(row["unset"], `${path}.unset`, validateCallStep, (unsetPath) =>
            fail(unsetPath, "must be an array of call steps"),
        );
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
