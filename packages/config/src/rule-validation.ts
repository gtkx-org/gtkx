import { z } from "zod";

export const ARG_REFS = ["child", "item", "value", "index", "sibling"] as const;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ArgRef = (typeof ARG_REFS)[number];

export type Arg =
    | ArgRef
    | { prop: string; or?: JsonValue }
    | { field: string; or?: JsonValue }
    | { literal: JsonValue };

export type Call = string | { method: string; args: Arg[] };

const NAME_MESSAGE = "must be a non-empty string";

const JSON_MESSAGE = "must be a JSON-serializable value";

const ARG_MESSAGE = "must be one of: reference name, { prop }, { field }, { literal }";

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

export type IssuePath = Array<string | number>;

export type CollectedIssue = { path: IssuePath; message: string };

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

const collectReferenceArgIssues = (value: Record<string, unknown>, key: "prop" | "field"): CollectedIssue[] => {
    const issues = unknownKeyIssues(value, [key, "or"]);
    if (!requireName(value[key])) issues.push({ path: [key], message: NAME_MESSAGE });
    if ("or" in value && !isJsonValue(value.or)) issues.push({ path: ["or"], message: JSON_MESSAGE });
    return issues;
};

const collectLiteralArgIssues = (value: Record<string, unknown>): CollectedIssue[] => {
    const issues = unknownKeyIssues(value, ["literal"]);
    if (!isJsonValue(value.literal)) issues.push({ path: ["literal"], message: JSON_MESSAGE });
    return issues;
};

const collectArgIssues = (value: unknown): CollectedIssue[] => {
    if (typeof value === "string") {
        return ARG_REF_SET.has(value) ? [] : [{ path: [], message: `has unknown reference "${value}"` }];
    }
    if (!isRecord(value)) return [{ path: [], message: ARG_MESSAGE }];
    if ("prop" in value) return collectReferenceArgIssues(value, "prop");
    if ("field" in value) return collectReferenceArgIssues(value, "field");
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
    const issues = unknownKeyIssues(value, ["method", "args"]);
    if (!requireName(value.method)) issues.push({ path: ["method"], message: NAME_MESSAGE });
    if (!Array.isArray(value.args)) issues.push({ path: ["args"], message: "must be an array" });
    else issues.push(...collectArgsIssues(value.args));
    return issues;
};

const callSchema = z.custom<Call>().check((ctx) => {
    ctx.issues.push(...collectCallIssues(ctx.value).map((issue) => rawIssue(ctx.value, issue.path, issue.message)));
});

const jsonSchema = z.custom<JsonValue>().check((ctx) => {
    if (!isJsonValue(ctx.value)) ctx.issues.push(rawIssue(ctx.value, [], JSON_MESSAGE));
});

const nameSchema = z.string({ error: NAME_MESSAGE }).min(1, { error: NAME_MESSAGE });

const settersSchema = z.record(z.string(), nameSchema, {
    error: "must be an object mapping prop names to method names",
});

const attachSchema = z.strictObject({
    kind: z.literal("attach"),
    parent: nameSchema,
    child: nameSchema,
    slot: nameSchema.optional(),
    add: callSchema.optional(),
    remove: callSchema.optional(),
    insert: callSchema.optional(),
    reorder: callSchema.optional(),
    autowrap: nameSchema.optional(),
});

const companionSchema = z.strictObject({
    kind: z.literal("companion"),
    element: nameSchema,
    parent: nameSchema,
    add: callSchema.optional(),
    insert: callSchema.optional(),
    remove: callSchema.optional(),
    companion: callSchema.optional(),
    setters: settersSchema.optional(),
    multi: z.boolean({ error: "must be a boolean" }).optional(),
});

const layoutChildSchema = z.strictObject({
    kind: z.literal("layout-child"),
    element: nameSchema,
    parent: nameSchema,
    layout: nameSchema,
});

const rejectSchema = z.strictObject({
    kind: z.literal("reject"),
    parent: nameSchema,
    child: nameSchema,
    prop: nameSchema,
});

const skipSchema = z.strictObject({
    kind: z.literal("skip"),
    child: nameSchema,
});

const relationshipSchema = z
    .discriminatedUnion("kind", [attachSchema, companionSchema, layoutChildSchema, rejectSchema, skipSchema], {
        error: "must be one of attach, companion, layout-child, reject, skip",
    })
    .check((ctx) => {
        const rule = ctx.value;
        if (rule.kind === "attach" && rule.add === undefined && rule.remove === undefined) {
            ctx.issues.push(rawIssue(rule, [], "must define at least one of `add` or `remove`"));
        }
    });

export type AttachRule = z.infer<typeof attachSchema>;

export type CompanionRule = z.infer<typeof companionSchema>;

export type LayoutChildRule = z.infer<typeof layoutChildSchema>;

export type RejectRule = z.infer<typeof rejectSchema>;

export type SkipRule = z.infer<typeof skipSchema>;

export type RelationshipRule = z.infer<typeof relationshipSchema>;

const listSchema = z.strictObject({
    kind: z.literal("list"),
    type: nameSchema,
    prop: nameSchema,
    clear: callSchema,
    add: callSchema,
});

const keyedListSchema = z.strictObject({
    kind: z.literal("keyed-list"),
    type: nameSchema,
    prop: nameSchema,
    add: callSchema,
    remove: callSchema,
    key: nameSchema.optional(),
    setters: settersSchema.optional(),
});

const valueSchema = z.strictObject({
    kind: z.literal("value"),
    type: nameSchema,
    prop: nameSchema,
    call: callSchema,
    or: jsonSchema.optional(),
    after: nameSchema.optional(),
});

const selectionSchema = z.strictObject({
    kind: z.literal("selection"),
    type: nameSchema,
    prop: nameSchema,
    get: nameSchema,
    set: nameSchema,
    lookup: nameSchema.optional(),
});

const controlledTextSchema = z.strictObject({
    kind: z.literal("controlled-text"),
    type: nameSchema,
    prop: nameSchema,
    get: nameSchema,
    set: nameSchema,
});

const reassertSchema = z.strictObject({
    kind: z.literal("reassert"),
    type: nameSchema,
    prop: nameSchema,
    set: callSchema,
});

const writeOnceListSchema = z.strictObject({
    kind: z.literal("write-once-list"),
    type: nameSchema,
    prop: nameSchema,
    add: callSchema,
});

const syntheticPropSchema = z
    .discriminatedUnion(
        "kind",
        [
            listSchema,
            keyedListSchema,
            valueSchema,
            selectionSchema,
            controlledTextSchema,
            reassertSchema,
            writeOnceListSchema,
        ],
        { error: "must be one of list, keyed-list, value, selection, controlled-text, reassert, write-once-list" },
    )
    .check((ctx) => {
        const rule = ctx.value;
        if (rule.kind === "keyed-list" && rule.setters !== undefined && rule.key === undefined) {
            ctx.issues.push(rawIssue(rule, ["setters"], "requires `key` to address items"));
        }
    });

export type ListRule = z.infer<typeof listSchema>;

export type KeyedListRule = z.infer<typeof keyedListSchema>;

export type ValueRule = z.infer<typeof valueSchema>;

export type SelectionRule = z.infer<typeof selectionSchema>;

export type ControlledTextRule = z.infer<typeof controlledTextSchema>;

export type ReassertRule = z.infer<typeof reassertSchema>;

export type WriteOnceListRule = z.infer<typeof writeOnceListSchema>;

export type SyntheticPropRule = z.infer<typeof syntheticPropSchema>;

export const gtkxRulesSchema = z.strictObject({
    relationships: z.array(relationshipSchema).optional(),
    syntheticProps: z.array(syntheticPropSchema).optional(),
});

export type GtkxRules = z.infer<typeof gtkxRulesSchema>;

export type ResolvedGtkxRules = {
    relationships: RelationshipRule[];
    syntheticProps: SyntheticPropRule[];
};

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

export const configError = (error: z.ZodError, basePath?: string): Error => {
    const issue = error.issues[0];
    if (issue === undefined) return new Error(`${CONFIG_PREFIX} invalid configuration`);
    const fullPath = basePath === undefined ? issue.path : [basePath, ...issue.path];
    return new Error(formatIssue(issue, fullPath));
};

export const validateGtkxRules = (value: unknown, path = "rules"): void => {
    const result = gtkxRulesSchema.safeParse(value);
    if (!result.success) throw configError(result.error, path);
};
