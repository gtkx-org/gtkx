import { z } from "zod";

type SerializedWidget = {
    id: string;
    type: string;
    role: string;
    name: string | null;
    text: string | null;
    isSensitive: boolean;
    isVisible: boolean;
    cssClasses: string[];
    children: SerializedWidget[];
    hiddenChildren?: number;
};

type SerializedProperty = {
    type: string;
    value: string | number | boolean | string[] | null;
    widgetId?: string;
    note?: string;
};

type AppInfo = {
    applicationId: string;
    pid: number;
    projectRoot?: string;
};

type ServerRequestParams<Method extends keyof typeof ServerRequestParamsSchemas> = z.infer<
    (typeof ServerRequestParamsSchemas)[Method]
>;

type ParamsSchema<Output> = z.ZodType<Output>;
type ServerInitiatedMethod = keyof typeof ServerRequestParamsSchemas;

const RegisterParamsSchema: z.ZodObject<
    {
        applicationId: z.ZodString;
        pid: z.ZodNumber;
        projectRoot: z.ZodOptional<z.ZodString>;
    }
> = z.object({
    applicationId: z.string(),
    pid: z.number(),
    projectRoot: z.string().optional(),
});

const emptyParams: z.ZodObject<Record<string, never>> = z.object({});

const widgetIdParams: z.ZodObject<{ widgetId: z.ZodString }> = z.object({
    widgetId: z.string(),
});

const DEFAULT_SUBTREE_DEPTH = 8;
const MAX_SUBTREE_WIDGETS = 30;

const widgetPropsParams: z.ZodObject<
    {
        widgetId: z.ZodString;
        properties: z.ZodOptional<z.ZodArray<z.ZodString>>;
        maxDepth: z.ZodOptional<z.ZodNumber>;
    }
> = z.object({
    widgetId: z.string(),
    properties: z.array(z.string()).optional(),
    maxDepth: z.number().int().nonnegative().optional(),
});

const treeParams: z.ZodObject<
    { rootId: z.ZodOptional<z.ZodString>; maxDepth: z.ZodOptional<z.ZodNumber> }
> = z.object({
    rootId: z.string().optional(),
    maxDepth: z.number().int().nonnegative().optional(),
});

const queryOptionsSchema: z.ZodObject<
    { name: z.ZodOptional<z.ZodString>; exact: z.ZodOptional<z.ZodBoolean>; timeout: z.ZodOptional<z.ZodNumber> }
> = z.object({
    name: z.string().optional(),
    exact: z.boolean().optional(),
    timeout: z.number().optional(),
});

const queryParams: z.ZodObject<
    {
        by: z.ZodEnum<{ role: "role"; text: "text"; name: "name"; labelText: "labelText" }>;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
        options: z.ZodOptional<typeof queryOptionsSchema>;
    }
> = z.object({
    by: z.enum(["role", "text", "name", "labelText"]),
    value: z.union([z.string(), z.number()]),
    options: queryOptionsSchema.optional(),
});

const typeParams: z.ZodObject<
    { widgetId: z.ZodString; text: z.ZodString; clear: z.ZodOptional<z.ZodBoolean> }
> = z.object({ widgetId: z.string(), text: z.string(), clear: z.boolean().optional() });

const fireEventParams: z.ZodObject<
    { widgetId: z.ZodString; signal: z.ZodString; args: z.ZodOptional<z.ZodArray<z.ZodUnknown>> }
> = z.object({ widgetId: z.string(), signal: z.string(), args: z.array(z.unknown()).optional() });

const screenshotParams: z.ZodObject<
    { windowId: z.ZodOptional<z.ZodString>; path: z.ZodOptional<z.ZodString> }
> = z.object({
    windowId: z.string().optional(),
    path: z.string().optional(),
});

const ServerRequestParamsSchemas: {
    "app.getWindows": typeof emptyParams;
    "widget.getTree": typeof treeParams;
    "widget.query": typeof queryParams;
    "widget.getProps": typeof widgetPropsParams;
    "widget.click": typeof widgetIdParams;
    "widget.type": typeof typeParams;
    "widget.fireEvent": typeof fireEventParams;
    "widget.screenshot": typeof screenshotParams;
} = {
    "app.getWindows": emptyParams,
    "widget.getTree": treeParams,
    "widget.query": queryParams,
    "widget.getProps": widgetPropsParams,
    "widget.click": widgetIdParams,
    "widget.type": typeParams,
    "widget.fireEvent": fireEventParams,
    "widget.screenshot": screenshotParams,
};

export {
    DEFAULT_SUBTREE_DEPTH,
    MAX_SUBTREE_WIDGETS,
    RegisterParamsSchema,
    widgetIdParams,
    widgetPropsParams,
    treeParams,
    queryParams,
    typeParams,
    fireEventParams,
    screenshotParams,
    ServerRequestParamsSchemas,
    type SerializedWidget,
    type SerializedProperty,
    type AppInfo,
    type ServerRequestParams,
    type ParamsSchema,
    type ServerInitiatedMethod,
};
