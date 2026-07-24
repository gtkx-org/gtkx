import { z } from "zod";

/**
 * Names the GObject type a container's `adopt` behavior resolves for each child. That type
 * becomes the wrapper element carrying the child's placement props.
 */
export type AdoptedElement = { element: string };

const NAME_MESSAGE = "must be a non-empty string";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

type IssuePath = Array<string | number>;

export const rawIssue = (input: unknown, path: IssuePath, message: string, standalone = false) => ({
    code: "custom" as const,
    input,
    path,
    message,
    continue: true as const,
    ...(standalone ? { params: { standalone: true } } : {}),
});

const nameSchema = z.string({ error: NAME_MESSAGE }).min(1, { error: NAME_MESSAGE });

const adoptedElementSchema = z.strictObject({ element: nameSchema });

const adoptSchema = z.union([z.literal(true), nameSchema, adoptedElementSchema], {
    error: "must be `true`, the name of a getter method, or `{ element }`",
});

const containerSchema = z.strictObject({
    kind: z.literal("container"),
    prop: nameSchema,
    child: nameSchema,
    append: nameSchema.optional(),
    remove: nameSchema.optional(),
    insert: nameSchema.optional(),
    reorder: nameSchema.optional(),
    autowrap: nameSchema.optional(),
    adopt: adoptSchema.optional(),
    childProps: z.array(nameSchema).min(1).optional(),
});

const valueSchema = z.strictObject({
    kind: z.literal("value"),
    prop: nameSchema,
    call: nameSchema,
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
    itemType: nameSchema.optional(),
    itemKey: nameSchema.optional(),
    add: z.union([nameSchema, z.array(nameSchema).min(1)]),
    remove: nameSchema.optional(),
    clear: nameSchema.optional(),
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
 * names a widget type each child is wrapped in before attaching, `childProps` names the
 * placement props read off each child, matched in order against the attach method's
 * parameters that are not the child itself, and `adopt` marks
 * pre-existing children as adopted (`true`), names the getter returning them, or
 * names the {@link AdoptedElement} its container behavior resolves.
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
 * Rule mapping an array prop to methods: `add` runs per added item (a single method,
 * or a sequence applied in order when one item needs several), `remove`
 * per removed item, and `clear` empties the collection before re-adding. `itemType`
 * names a `@gtkx/react` export to use as the item type instead of deriving one from GIR, and
 * `itemKey` names the item field the trailing `add` calls take as their first argument.
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
