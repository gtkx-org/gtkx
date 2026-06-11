/**
 * Serializable row schemas for the reconciler's data tables.
 *
 * Every type here is plain JSON-representable data: GLib type names, method
 * names, item key paths, and finite condition vocabularies. `@gtkx/react`
 * ships built-in rows in these shapes and merges them in front of the rows a
 * project declares in `gtkx.config.ts` (`elementMap`, `arrayProps`), which
 * reach the reconciler through the `virtual:gtkx-config` module. No row
 * carries executable code; a single generic interpreter in `@gtkx/react`
 * applies them.
 */

/**
 * The shape of an attach/detach method's argument list, resolved against the
 * `(child, parent)` pair at call time:
 *
 * - `"child"` — the child's backing GObject
 * - `"childName"` — the result of the child's `getName()`
 * - `"null"` — the literal `null`
 * - `"prefixChild"` — the child's `prefix` prop followed by its backing GObject
 * - `"prefixNull"` — the child's `prefix` prop followed by `null`
 */
export type VerbArgs = "child" | "childName" | "null" | "prefixChild" | "prefixNull";

/**
 * A verb that calls one method on the parent to attach and one to detach,
 * each with a {@link VerbArgs} argument shape. `detachGuard`, when set, skips
 * the detach call unless the named getter still links the two instances, so a
 * verb never removes a relationship GTK no longer holds.
 */
export type MethodVerb = {
    /** Discriminates the verb shape. */
    readonly kind: "method";
    /** Method called on the parent to attach the child. */
    readonly attach: string;
    /** Argument shape of the attach call. */
    readonly attachArgs: VerbArgs;
    /** Method called on the parent to detach the child. */
    readonly detach: string;
    /** Argument shape of the detach call. */
    readonly detachArgs: VerbArgs;
    /** Getter-based guard that must still link the pair for detach to run. */
    readonly detachGuard?: { readonly side: "child" | "parent"; readonly getter: string };
};

/**
 * A verb for ordered multi-child relationships exposed through a positional
 * insert method and a list-model collection getter (e.g. `Gtk.ColumnView`
 * columns). The interpreter computes the insert position from the reconciler's
 * anchor against the live collection, skips re-inserts that are already in
 * place, and re-inserts on reorder.
 */
export type OrderedInsertVerb = {
    /** Discriminates the verb shape. */
    readonly kind: "orderedInsert";
    /** Method called on the parent as `attach(position, child)`. */
    readonly attach: string;
    /** Method called on the parent as `detach(child)`. */
    readonly detach: string;
    /** Parent getter returning the live `Gio.ListModel` of attached children. */
    readonly collection: string;
};

/** The verb vocabulary an {@link ElementMapRule} can carry. */
export type AttachVerb = MethodVerb | OrderedInsertVerb;

/**
 * One attach relationship as data: which child type attaches to which parent
 * (by GLib type name or by an exposed method), through which verb.
 */
export type ElementMapRule = {
    /** GLib type name that must appear in the child's GType ancestry. */
    readonly child: string;
    /** GLib type name that must appear in the parent's GType ancestry. */
    readonly parentType?: string;
    /** A method name the parent must expose, used in place of `parentType`. */
    readonly parentMethod?: string;
    /** The verb applied when the relationship matches. */
    readonly verb: AttachVerb;
};

/**
 * A presence condition on an item field: `"defined"` passes for any value
 * except `undefined`; `"nonNull"` additionally rejects `null`.
 */
export type PresenceCondition = "defined" | "nonNull";

/**
 * One argument of a {@link CallStep}, resolved against the array element:
 * an item field (the whole item when `path` is omitted, with `fallback`
 * substituted for `null`/`undefined` values when declared), or a literal value.
 */
export type CallArg =
    | { readonly kind: "item"; readonly path?: string; readonly fallback?: unknown }
    | { readonly kind: "value"; readonly value: unknown };

/**
 * One method call applied per array element, with arguments resolved from the
 * element's fields. `when` skips the call unless the named field satisfies the
 * condition.
 */
export type CallStep = {
    /** Method called on the target widget. */
    readonly method: string;
    /** The call's argument list. */
    readonly args: readonly CallArg[];
    /** Skips the call unless the named item field satisfies the condition. */
    readonly when?: { readonly path: string; readonly is: PresenceCondition };
};

/**
 * One setter applied to a constructed object from an item field, guarded by a
 * {@link PresenceCondition} on that field.
 */
export type ConstructSetter = {
    /** Setter method called on the constructed object. */
    readonly method: string;
    /** Item field providing the setter's argument. */
    readonly path: string;
    /** Condition the field must satisfy for the setter to run. */
    readonly when: PresenceCondition;
};

/**
 * Describes adding one array element by constructing a GObject by GLib type
 * name (through the live class registry), applying {@link ConstructSetter}s
 * from the element's fields, then attaching it via the named method.
 */
export type ConstructStep = {
    /** GLib type name of the object constructed per element. */
    readonly type: string;
    /** Setters applied to the constructed object from item fields. */
    readonly setters: readonly ConstructSetter[];
    /** Method called on the target widget as `attach(constructed)`. */
    readonly attach: string;
};

/**
 * One array-valued prop as data: the item-type name its generated `Props`
 * line declares, plus the verbs that reconcile elements into repeated GTK
 * calls. Apply order: `set` replaces the whole list in one call; otherwise
 * old elements are removed (`clear` once, else `remove` each) and new ones
 * added (`add` steps or `construct` each). `appendOnce` marks an immutable
 * list applied only when the previous one was empty.
 */
export type ArrayPropRow = {
    /** Item-type name declared in the generated `Props` interface: an exported member of `@gtkx/react`, or a qualified GIR type such as `Gtk.Widget`. */
    readonly itemType: string;
    /** Method removing every previously-applied element in one call. */
    readonly clear?: string;
    /** Call removing one previously-applied element. */
    readonly remove?: CallStep;
    /** Calls adding one current element. */
    readonly add?: readonly CallStep[];
    /** Adds one current element by constructing a GObject by type name. */
    readonly construct?: ConstructStep;
    /** Method replacing the whole list in one call. */
    readonly set?: string;
    /** When true, the list is immutable: applied only when the previous list was empty. */
    readonly appendOnce?: boolean;
};

/**
 * One object-valued prop as data: the item-type name its generated `Props`
 * line declares, plus the calls that apply the object's fields to the target.
 * When the prop holds a value, the `set` steps run with arguments resolved
 * against it; when it becomes `null`/`undefined`, the `unset` steps run.
 */
export type ObjectPropRow = {
    /** Item-type name declared in the generated `Props` interface: an exported member of `@gtkx/react`, or a qualified GIR type such as `Gtk.Widget`. */
    readonly itemType: string;
    /** Calls applying the current object's fields to the target. */
    readonly set: readonly CallStep[];
    /** Calls resetting the target when the prop is cleared. */
    readonly unset?: readonly CallStep[];
};

/**
 * One virtual prop as data: a prop with no GObject property backing whose
 * value is forwarded verbatim to a setter method. The generated `Props` line
 * types it with the named GIR type (e.g. a GIR callback type), the setter is
 * called with the value — `null` when the prop is cleared — and `after`
 * optionally names a zero-argument method invoked after every set (e.g.
 * `queueDraw` after installing a draw function).
 */
export type VirtualPropRow = {
    /** Qualified GIR type the prop carries (e.g. `"Gtk.DrawingAreaDrawFunc"`). */
    readonly type: string;
    /** Method called on the target with the prop value, or `null` when cleared. */
    readonly setter: string;
    /** Zero-argument method invoked after every set. */
    readonly after?: string;
};

/**
 * A condition on a prop's current value: `"defined"` passes for any value
 * except `undefined`, `"nonNull"` additionally rejects `null`, and
 * `"truthy"` requires a truthy value.
 */
export type PropCondition = "defined" | "nonNull" | "truthy";

/**
 * One setter applied from a prop's current value: a method call (`call`) or a
 * property write (`set`), guarded by a {@link PropCondition} and the optional
 * getter checks.
 */
export type SetterPropStep = {
    /** The prop the step reads. */
    readonly prop: string;
    /** Method called on the instance with the prop value. */
    readonly call?: string;
    /** Property written on the instance with the prop value. */
    readonly set?: string;
    /** Condition the prop value must satisfy for the step to run. */
    readonly when?: PropCondition;
    /** Skips the step when the named getter already returns the prop value. */
    readonly skipWhenGetterEquals?: string;
    /** Skips the step unless the named getter, called with the prop value, returns truthy. */
    readonly requireGetterTruthyWithValue?: string;
};

/**
 * A group of {@link SetterPropStep}s sharing one application pass. Without
 * `always`, each step applies when its own prop changes; with `always`, the
 * whole group reapplies on every commit.
 */
export type SetterPropGroup = {
    /** Discriminates the rule shape. */
    readonly kind: "setters";
    /** The group's setter steps. */
    readonly props: readonly SetterPropStep[];
    /** Reapplies the whole group on every commit. */
    readonly always?: boolean;
};

/**
 * A callback prop bound to a GObject signal, with the argument and
 * return-value refinements the generic signal path cannot express.
 */
export type SignalPropRule = {
    /** Discriminates the rule shape. */
    readonly kind: "signal";
    /** The callback prop the rule binds. */
    readonly prop: string;
    /** The GObject signal the callback connects to. */
    readonly signal: string;
    /** Calls the callback with no arguments instead of the raw signal arguments. */
    readonly noArgs?: boolean;
    /** The value the GObject signal handler returns. */
    readonly returnValue?: unknown;
};

/** One prop rule: a setter group or a refined signal binding. */
export type PropRule = SetterPropGroup | SignalPropRule;

/** The argument vocabulary of an {@link AddMethodRule}: the attached widget or a page prop. */
export type AddMethodArg = "widget" | "id" | "title" | "iconName";

/**
 * One candidate page-add method of a stack-like parent: chosen when every
 * prop in `requires` is set, called with `args` resolved from the attached
 * widget and the page props.
 */
export type AddMethodRule = {
    /** Method called on the parent. */
    readonly method: string;
    /** The call's argument list. */
    readonly args: readonly AddMethodArg[];
    /** Page props that must be set for this method to be chosen. */
    readonly requires: readonly AddMethodArg[];
};

/**
 * One page-metadata setter applied to a stack page handle: duck-typed by the
 * setter's presence, applied from the named prop with `fallback` when unset,
 * or skipped entirely when `whenPresent` and the prop is `undefined`.
 */
export type PageMetaSetter = {
    /** Setter method probed and called on the page handle. */
    readonly setter: string;
    /** The page prop providing the value. */
    readonly prop: string;
    /** Value applied when the prop is unset. */
    readonly fallback?: unknown;
    /** Skips the setter entirely when the prop is `undefined`. */
    readonly whenPresent?: boolean;
};

const GLIB_TYPE_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
const METHOD_NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const VERB_ARGS: readonly VerbArgs[] = ["child", "childName", "null", "prefixChild", "prefixNull"];
const PRESENCE_CONDITIONS: readonly PresenceCondition[] = ["defined", "nonNull"];

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
    requireMethodName(verb.attach, `${path}.attach`);
    requireMethodName(verb.detach, `${path}.detach`);
    for (const key of ["attachArgs", "detachArgs"] as const) {
        if (!VERB_ARGS.includes(verb[key] as VerbArgs)) {
            fail(`${path}.${key}`, `must be one of ${VERB_ARGS.join(", ")}`);
        }
    }
    if (verb.detachGuard !== undefined) {
        const guard = requireRecord(verb.detachGuard, `${path}.detachGuard`);
        if (guard.side !== "child" && guard.side !== "parent") {
            fail(`${path}.detachGuard.side`, 'must be "child" or "parent"');
        }
        requireMethodName(guard.getter, `${path}.detachGuard.getter`);
    }
};

const validateOrderedInsertVerb = (verb: Record<string, unknown>, path: string): void => {
    requireMethodName(verb.attach, `${path}.attach`);
    requireMethodName(verb.detach, `${path}.detach`);
    requireMethodName(verb.collection, `${path}.collection`);
};

const validateVerb = (value: unknown, path: string): void => {
    const verb = requireRecord(value, path);
    if (verb.kind === "method") validateMethodVerb(verb, path);
    else if (verb.kind === "orderedInsert") validateOrderedInsertVerb(verb, path);
    else fail(`${path}.kind`, 'must be "method" or "orderedInsert"');
};

/**
 * Validates the `elementMap` rows declared in `gtkx.config.ts`, throwing a
 * descriptive error naming the offending row and field.
 *
 * @param elementMap - The `elementMap` value from the config, or `undefined`
 */
export const validateElementMap = (elementMap: unknown): void => {
    if (elementMap === undefined) return;
    if (!Array.isArray(elementMap)) fail("elementMap", "must be an array of attach rules");
    (elementMap as unknown[]).forEach((value, index) => {
        const path = `elementMap[${index}]`;
        const rule = requireRecord(value, path);
        requireTypeName(rule.child, `${path}.child`);
        if (rule.parentType === undefined && rule.parentMethod === undefined) {
            fail(path, "must declare `parentType` or `parentMethod`");
        }
        if (rule.parentType !== undefined) requireTypeName(rule.parentType, `${path}.parentType`);
        if (rule.parentMethod !== undefined) requireMethodName(rule.parentMethod, `${path}.parentMethod`);
        validateVerb(rule.verb, `${path}.verb`);
    });
};

const validateWhen = (when: unknown, path: string): void => {
    if (when === undefined) return;
    const condition = requireRecord(when, path);
    requireFieldName(condition.path, `${path}.path`);
    if (!PRESENCE_CONDITIONS.includes(condition.is as PresenceCondition)) {
        fail(`${path}.is`, `must be one of ${PRESENCE_CONDITIONS.join(", ")}`);
    }
};

const validateCallArg = (value: unknown, path: string): void => {
    const arg = requireRecord(value, path);
    if (arg.kind === "item") {
        if (arg.path !== undefined) requireFieldName(arg.path, `${path}.path`);
        return;
    }
    if (arg.kind !== "value") fail(`${path}.kind`, 'must be "item" or "value"');
};

const validateCallStep = (value: unknown, path: string): void => {
    const step = requireRecord(value, path);
    requireMethodName(step.method, `${path}.method`);
    if (!Array.isArray(step.args)) fail(`${path}.args`, "must be an array");
    (step.args as unknown[]).forEach((arg, index) => {
        validateCallArg(arg, `${path}.args[${index}]`);
    });
    validateWhen(step.when, `${path}.when`);
};

const validateConstructStep = (value: unknown, path: string): void => {
    const step = requireRecord(value, path);
    requireTypeName(step.type, `${path}.type`);
    requireMethodName(step.attach, `${path}.attach`);
    if (!Array.isArray(step.setters)) fail(`${path}.setters`, "must be an array");
    (step.setters as unknown[]).forEach((setter, index) => {
        const setterPath = `${path}.setters[${index}]`;
        const record = requireRecord(setter, setterPath);
        requireMethodName(record.method, `${setterPath}.method`);
        requireFieldName(record.path, `${setterPath}.path`);
        if (!PRESENCE_CONDITIONS.includes(record.when as PresenceCondition)) {
            fail(`${setterPath}.when`, `must be one of ${PRESENCE_CONDITIONS.join(", ")}`);
        }
    });
};

const ITEM_TYPE_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

const validateArrayPropRow = (value: unknown, path: string): void => {
    const row = requireRecord(value, path);
    if (typeof row.itemType !== "string" || !ITEM_TYPE_NAME_PATTERN.test(row.itemType)) {
        fail(`${path}.itemType`, `must be a PascalCase exported member of @gtkx/react (e.g. "ScaleMark")`);
    }
    if (row.clear !== undefined) requireMethodName(row.clear, `${path}.clear`);
    if (row.set !== undefined) requireMethodName(row.set, `${path}.set`);
    if (row.appendOnce !== undefined && typeof row.appendOnce !== "boolean") {
        fail(`${path}.appendOnce`, "must be a boolean");
    }
    if (row.remove !== undefined) validateCallStep(row.remove, `${path}.remove`);
    if (row.add !== undefined) {
        if (!Array.isArray(row.add)) fail(`${path}.add`, "must be an array of call steps");
        (row.add as unknown[]).forEach((step, index) => {
            validateCallStep(step, `${path}.add[${index}]`);
        });
    }
    if (row.construct !== undefined) validateConstructStep(row.construct, `${path}.construct`);
};

/**
 * Validates the `arrayProps` rows declared in `gtkx.config.ts`, throwing a
 * descriptive error naming the offending element, prop, and field.
 *
 * @param arrayProps - The `arrayProps` value from the config, or `undefined`
 */
export const validateArrayPropRows = (arrayProps: unknown): void => {
    validatePropRowMap(arrayProps, "arrayProps", validateArrayPropRow);
};

const validateObjectPropRow = (value: unknown, path: string): void => {
    const row = requireRecord(value, path);
    if (typeof row.itemType !== "string" || !ITEM_TYPE_NAME_PATTERN.test(row.itemType)) {
        fail(`${path}.itemType`, `must be a PascalCase exported member of @gtkx/react (e.g. "DragSourceIcon")`);
    }
    if (!Array.isArray(row.set)) fail(`${path}.set`, "must be an array of call steps");
    (row.set as unknown[]).forEach((step, index) => {
        validateCallStep(step, `${path}.set[${index}]`);
    });
    if (row.unset !== undefined) {
        if (!Array.isArray(row.unset)) fail(`${path}.unset`, "must be an array of call steps");
        (row.unset as unknown[]).forEach((step, index) => {
            validateCallStep(step, `${path}.unset[${index}]`);
        });
    }
};

/**
 * Validates the `objectProps` rows declared in `gtkx.config.ts`, throwing a
 * descriptive error naming the offending element, prop, and field.
 *
 * @param objectProps - The `objectProps` value from the config, or `undefined`
 */
export const validateObjectPropRows = (objectProps: unknown): void => {
    validatePropRowMap(objectProps, "objectProps", validateObjectPropRow);
};

const QUALIFIED_TYPE_PATTERN = /^[A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9]*$/;

const validateVirtualPropRow = (value: unknown, path: string): void => {
    const row = requireRecord(value, path);
    if (typeof row.type !== "string" || !QUALIFIED_TYPE_PATTERN.test(row.type)) {
        fail(`${path}.type`, `must be a qualified GIR type (e.g. "Gtk.DrawingAreaDrawFunc")`);
    }
    requireMethodName(row.setter, `${path}.setter`);
    if (row.after !== undefined) requireMethodName(row.after, `${path}.after`);
};

/**
 * Validates the `virtualProps` rows declared in `gtkx.config.ts`, throwing a
 * descriptive error naming the offending element, prop, and field.
 *
 * @param virtualProps - The `virtualProps` value from the config, or `undefined`
 */
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
