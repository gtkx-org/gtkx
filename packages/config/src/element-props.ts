import { z } from "zod";

const ARG_REFS = ["child", "item", "index", "sibling", "adopted"] as const;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Named reference to a value available while invoking a {@link Call}: the child
 * widget, the current list item, its index, the preceding sibling, or the
 * adopted instance a container returned for the child.
 */
export type ArgRef = (typeof ARG_REFS)[number];

/**
 * An argument built by instantiating the GObject type `build` and applying its
 * own prop rule named `prop` to the array held by the current item's `from`
 * field. Naming the enclosing type and prop makes the rule recursive, which is
 * how a nested menu model is assembled from a tree of items.
 */
export type BuildArg = { build: string; prop: string; from: string };

/**
 * A single argument passed to a method {@link Call}: an {@link ArgRef}, a value
 * read from a React prop (`{ prop }`), a field read off the current item with an
 * optional fallback (`{ field, or }`), a constant (`{ literal }`), or a nested
 * object assembled from the item ({@link BuildArg}).
 */
export type Arg = ArgRef | { prop: string } | { field: string; or?: JsonValue } | { literal: JsonValue } | BuildArg;

/**
 * A GObject method invocation: either a bare method name called with default
 * arguments, or a method name paired with an explicit list of {@link Arg}s.
 * When invoked per item, `when` restricts the call to items carrying that field
 * and `unless` skips items carrying any of the named fields.
 */
export type Call = string | { method: string; args: Arg[]; when?: string; unless?: string[] };

const NAME_MESSAGE = "must be a non-empty string";

const JSON_MESSAGE = "must be a JSON-serializable value";

const ARG_MESSAGE = "must be one of: reference name, { prop }, { field }, { literal }, { build }";

const FIELD_LIST_MESSAGE = "must be an array of field names";

const ARG_REF_SET: Set<string> = new Set(ARG_REFS);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): boolean => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return true;
    }
    if (Array.isArray(value)) return value.every(isJsonValue);
    if (isRecord(value)) return Object.values(value).every(isJsonValue);
    return false;
};

type IssuePath = Array<string | number>;

type CollectedIssue = { path: IssuePath; message: string };

export const rawIssue = (input: unknown, path: IssuePath, message: string, standalone = false) => ({
    code: "custom" as const,
    input,
    path,
    message,
    continue: true as const,
    ...(standalone ? { params: { standalone: true } } : {}),
});

const unknownKeyIssues = (value: Record<string, unknown>, allowed: string[]): CollectedIssue[] =>
    Object.keys(value)
        .filter((key) => !allowed.includes(key))
        .map((key) => ({ path: [key], message: "is not a recognized key" }));

const requireName = (value: unknown): boolean => typeof value === "string" && value.length > 0;

const collectPropArgIssues = (value: Record<string, unknown>): CollectedIssue[] => {
    const issues = unknownKeyIssues(value, ["prop"]);
    if (!requireName(value.prop)) issues.push({ path: ["prop"], message: NAME_MESSAGE });
    return issues;
};

const collectFieldArgIssues = (value: Record<string, unknown>): CollectedIssue[] => {
    const issues = unknownKeyIssues(value, ["field", "or"]);
    if (!requireName(value.field)) issues.push({ path: ["field"], message: NAME_MESSAGE });
    if ("or" in value && !isJsonValue(value.or)) issues.push({ path: ["or"], message: JSON_MESSAGE });
    return issues;
};

const collectLiteralArgIssues = (value: Record<string, unknown>): CollectedIssue[] => {
    const issues = unknownKeyIssues(value, ["literal"]);
    if (!isJsonValue(value.literal)) issues.push({ path: ["literal"], message: JSON_MESSAGE });
    return issues;
};

const collectBuildArgIssues = (value: Record<string, unknown>): CollectedIssue[] => {
    const issues = unknownKeyIssues(value, ["build", "prop", "from"]);
    for (const key of ["build", "prop", "from"]) {
        if (!requireName(value[key])) issues.push({ path: [key], message: NAME_MESSAGE });
    }
    return issues;
};

const collectArgIssues = (value: unknown): CollectedIssue[] => {
    if (typeof value === "string") {
        return ARG_REF_SET.has(value) ? [] : [{ path: [], message: `has unknown reference "${value}"` }];
    }
    if (!isRecord(value)) return [{ path: [], message: ARG_MESSAGE }];
    if ("build" in value) return collectBuildArgIssues(value);
    if ("prop" in value) return collectPropArgIssues(value);
    if ("field" in value) return collectFieldArgIssues(value);
    if ("literal" in value) return collectLiteralArgIssues(value);
    return [{ path: [], message: ARG_MESSAGE }];
};

const collectArgsIssues = (args: unknown[]): CollectedIssue[] =>
    args.flatMap((arg, index) =>
        collectArgIssues(arg).map((issue) => ({ path: ["args", index, ...issue.path], message: issue.message })),
    );

const collectCallIssues = (value: unknown): CollectedIssue[] => {
    if (typeof value === "string") return value.length === 0 ? [{ path: [], message: NAME_MESSAGE }] : [];
    if (!isRecord(value)) return [{ path: [], message: "must be an object" }];
    const issues = unknownKeyIssues(value, ["method", "args", "when", "unless"]);
    if (!requireName(value.method)) issues.push({ path: ["method"], message: NAME_MESSAGE });
    if (!Array.isArray(value.args)) issues.push({ path: ["args"], message: "must be an array" });
    else issues.push(...collectArgsIssues(value.args));
    if ("when" in value && !requireName(value.when)) issues.push({ path: ["when"], message: NAME_MESSAGE });
    if ("unless" in value && !(Array.isArray(value.unless) && value.unless.every(requireName))) {
        issues.push({ path: ["unless"], message: FIELD_LIST_MESSAGE });
    }
    return issues;
};

const callSchema = z.custom<Call>().check((ctx) => {
    ctx.issues.push(...collectCallIssues(ctx.value).map((issue) => rawIssue(ctx.value, issue.path, issue.message)));
});

const nameSchema = z.string({ error: NAME_MESSAGE }).min(1, { error: NAME_MESSAGE });

const adoptSchema = z.union([z.literal(true), nameSchema], {
    error: "must be `true` or the name of a getter method",
});

const containerSchema = z.strictObject({
    kind: z.literal("container"),
    prop: nameSchema,
    child: nameSchema,
    append: callSchema.optional(),
    remove: callSchema.optional(),
    insert: callSchema.optional(),
    reorder: callSchema.optional(),
    autowrap: nameSchema.optional(),
    adopt: adoptSchema.optional(),
});

const valueSchema = z.strictObject({
    kind: z.literal("value"),
    prop: nameSchema,
    call: callSchema,
    after: nameSchema.optional(),
});

const controlledTextSchema = z.strictObject({
    kind: z.literal("controlled-text"),
    prop: nameSchema,
});

const lazySchema = z.strictObject({
    kind: z.literal("lazy"),
    prop: nameSchema,
    lookup: nameSchema.optional(),
});

const listSchema = z.strictObject({
    kind: z.literal("list"),
    prop: nameSchema,
    add: z.union([callSchema, z.array(callSchema).min(1)]),
    remove: callSchema.optional(),
    clear: callSchema.optional(),
});

const elementPropSchema = z
    .discriminatedUnion("kind", [containerSchema, valueSchema, controlledTextSchema, lazySchema, listSchema], {
        error: "must be one of container, value, controlled-text, lazy, list",
    })
    .check((ctx) => {
        const prop = ctx.value;
        if (prop.kind === "container" && prop.append === undefined && prop.remove === undefined) {
            ctx.issues.push(rawIssue(prop, [], "must define at least one of `append` or `remove`"));
        }
    });

export const elementPropsSchema = z.record(nameSchema, z.array(elementPropSchema));

/**
 * Rule describing how children of a given type are attached to and removed from a
 * container element. `prop` is the React prop holding the children and `child` the
 * child GObject type. `append`/`remove` add and remove a child, `insert` places
 * one at an index or after a sibling, `reorder` moves an existing child, `autowrap`
 * names a widget type each child is wrapped in before attaching, and `adopt` marks
 * pre-existing children as adopted (`true`) or names the getter returning them.
 */
export type ContainerProp = z.infer<typeof containerSchema>;

/**
 * Rule that applies a scalar prop value by invoking `call` whenever the value
 * changes, optionally running the method named by `after` once it is set.
 */
export type ValueProp = z.infer<typeof valueSchema>;

/**
 * Rule for a controlled text prop: `prop` is written directly to the GObject
 * property and kept in sync with the element's own edits.
 */
export type ControlledTextProp = z.infer<typeof controlledTextSchema>;

/**
 * Rule for a prop applied after construction rather than at construction time,
 * optionally guarded by `lookup`, a method that must succeed for the value before
 * it is assigned.
 */
export type LazyProp = z.infer<typeof lazySchema>;

/**
 * Rule mapping an array prop to method calls: `add` runs per added item (a single
 * call, or a sequence of calls applied in order when one item needs several), `remove`
 * per removed item, and `clear` empties the collection before re-adding.
 */
export type ListProp = z.infer<typeof listSchema>;

/**
 * Any prop rule applied directly to an element instance rather than through
 * container child attachment: a {@link ValueProp}, {@link ControlledTextProp},
 * {@link LazyProp}, or {@link ListProp}.
 */
export type AppliedProp = ValueProp | ControlledTextProp | LazyProp | ListProp;

/**
 * A single entry in an element's prop mapping, discriminated by `kind`: a
 * container, value, controlled-text, lazy, or list rule.
 */
export type ElementProp = z.infer<typeof elementPropSchema>;

const CONFIG_PREFIX = "gtkx.config.ts:";

const dottedPath = (segments: PropertyKey[]): string =>
    segments.reduce<string>((acc, segment) => {
        if (typeof segment === "number") return `${acc}[${segment}]`;
        return acc === "" ? String(segment) : `${acc}.${String(segment)}`;
    }, "");

const isStandaloneIssue = (issue: z.core.$ZodIssue): boolean =>
    "params" in issue && isRecord(issue.params) && issue.params.standalone === true;

const formatIssue = (issue: z.core.$ZodIssue, fullPath: PropertyKey[]): string => {
    if (issue.code === "unrecognized_keys") {
        const [key] = issue.keys;
        const path = dottedPath(key === undefined ? fullPath : [...fullPath, key]);
        return `${CONFIG_PREFIX} \`${path}\` is not a recognized key`;
    }
    if (isStandaloneIssue(issue)) return `${CONFIG_PREFIX} ${issue.message}`;
    const path = dottedPath(fullPath);
    return path === "" ? `${CONFIG_PREFIX} ${issue.message}` : `${CONFIG_PREFIX} \`${path}\` ${issue.message}`;
};

export const configError = (error: z.ZodError): Error => {
    const issue = error.issues[0];
    if (issue === undefined) return new Error(`${CONFIG_PREFIX} invalid configuration`);
    return new Error(formatIssue(issue, issue.path));
};
