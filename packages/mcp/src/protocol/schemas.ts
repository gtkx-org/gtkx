import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const RequestSchema: z.ZodObject<
    {
        id: z.ZodString;
        method: z.ZodString;
        params: z.ZodOptional<z.ZodUnknown>;
    },
    z.core.$strip
> = z.object({
    id: z.string(),
    method: z.string(),
    params: z.unknown().optional(),
});

export type Request = z.infer<typeof RequestSchema>;

const ErrorSchema: z.ZodObject<
    { code: z.ZodNumber; message: z.ZodString; data: z.ZodOptional<z.ZodUnknown> },
    z.core.$strip
> = z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
});

export const ResponseSchema: z.ZodObject<
    {
        id: z.ZodString;
        result: z.ZodOptional<z.ZodUnknown>;
        error: z.ZodOptional<typeof ErrorSchema>;
    },
    z.core.$strip
> = z.object({
    id: z.string(),
    result: z.unknown().optional(),
    error: ErrorSchema.optional(),
});

export type Response = z.infer<typeof ResponseSchema>;

export type SerializedWidget = {
    id: string;
    type: string;
    role: string;
    name: string | null;
    text: string | null;
    sensitive: boolean;
    visible: boolean;
    cssClasses: string[];
    children: SerializedWidget[];
};

export type AppInfo = {
    applicationId: string;
    pid: number;
};

export const RegisterParamsSchema: z.ZodObject<
    {
        applicationId: z.ZodString;
        pid: z.ZodNumber;
    },
    z.core.$strip
> = z.object({
    applicationId: z.string(),
    pid: z.number(),
});

const emptyParams: z.ZodObject<Record<string, never>, z.core.$strip> = z.object({});
export const widgetIdParams: z.ZodObject<{ widgetId: z.ZodString }, z.core.$strip> = z.object({
    widgetId: z.string(),
});
export const queryOptionsSchema: z.ZodObject<
    { name: z.ZodOptional<z.ZodString>; exact: z.ZodOptional<z.ZodBoolean>; timeout: z.ZodOptional<z.ZodNumber> },
    z.core.$strip
> = z.object({
    name: z.string().optional(),
    exact: z.boolean().optional(),
    timeout: z.number().optional(),
});

export const queryParams: z.ZodObject<
    {
        by: z.ZodEnum<{ role: "role"; text: "text"; name: "name"; labelText: "labelText" }>;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
        options: z.ZodOptional<typeof queryOptionsSchema>;
    },
    z.core.$strip
> = z.object({
    by: z.enum(["role", "text", "name", "labelText"]),
    value: z.union([z.string(), z.number()]),
    options: queryOptionsSchema.optional(),
});
export const typeParams: z.ZodObject<
    { widgetId: z.ZodString; text: z.ZodString; clear: z.ZodOptional<z.ZodBoolean> },
    z.core.$strip
> = z.object({ widgetId: z.string(), text: z.string(), clear: z.boolean().optional() });
export const fireEventParams: z.ZodObject<
    { widgetId: z.ZodString; signal: z.ZodString; args: z.ZodOptional<z.ZodArray<z.ZodUnknown>> },
    z.core.$strip
> = z.object({ widgetId: z.string(), signal: z.string(), args: z.array(z.unknown()).optional() });
export const screenshotParams: z.ZodObject<
    { windowId: z.ZodOptional<z.ZodString>; path: z.ZodOptional<z.ZodString> },
    z.core.$strip
> = z.object({
    windowId: z.string().optional(),
    path: z.string().optional(),
});

export const ServerRequestParamsSchemas: {
    "app.getWindows": typeof emptyParams;
    "widget.getTree": typeof emptyParams;
    "widget.query": typeof queryParams;
    "widget.getProps": typeof widgetIdParams;
    "widget.click": typeof widgetIdParams;
    "widget.type": typeof typeParams;
    "widget.fireEvent": typeof fireEventParams;
    "widget.screenshot": typeof screenshotParams;
} = {
    "app.getWindows": emptyParams,
    "widget.getTree": emptyParams,
    "widget.query": queryParams,
    "widget.getProps": widgetIdParams,
    "widget.click": widgetIdParams,
    "widget.type": typeParams,
    "widget.fireEvent": fireEventParams,
    "widget.screenshot": screenshotParams,
};

export type ServerRequestParams<Method extends keyof typeof ServerRequestParamsSchemas> = z.infer<
    (typeof ServerRequestParamsSchemas)[Method]
>;

export type ParamsSchema<Output> = z.ZodType<Output>;

export type ServerInitiatedMethod = keyof typeof ServerRequestParamsSchemas;

export type Message = Request | Response;

const getRuntimeDir = (): string => process.env.XDG_RUNTIME_DIR ?? tmpdir();

export const DEFAULT_SOCKET_PATH: string = join(getRuntimeDir(), "gtkx-mcp.sock");
