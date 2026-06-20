import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

/**
 * Zod schema for validating IPC requests.
 */
export const IpcRequestSchema: z.ZodObject<
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

/**
 * An IPC request message.
 */
export type IpcRequest = z.infer<typeof IpcRequestSchema>;

/**
 * Zod schema for validating IPC errors.
 */
const IpcErrorSchema: z.ZodObject<
    { code: z.ZodNumber; message: z.ZodString; data: z.ZodOptional<z.ZodUnknown> },
    z.core.$strip
> = z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
});

/**
 * Zod schema for validating IPC responses.
 */
export const IpcResponseSchema: z.ZodObject<
    {
        id: z.ZodString;
        result: z.ZodOptional<z.ZodUnknown>;
        error: z.ZodOptional<typeof IpcErrorSchema>;
    },
    z.core.$strip
> = z.object({
    id: z.string(),
    result: z.unknown().optional(),
    error: IpcErrorSchema.optional(),
});

/**
 * An IPC response message.
 */
export type IpcResponse = z.infer<typeof IpcResponseSchema>;

/**
 * A serialized representation of a GTK widget for IPC transfer.
 */
export type SerializedWidget = {
    /** Unique widget identifier */
    id: string;
    /** Widget type name (e.g., "GtkButton") */
    type: string;
    /** Accessible role */
    role: string;
    /** Widget name (test ID) */
    name: string | null;
    /** Text content */
    text: string | null;
    /** Whether the widget is sensitive (interactive) */
    sensitive: boolean;
    /** Whether the widget is visible */
    visible: boolean;
    /** CSS class names */
    cssClasses: string[];
    /** Child widgets */
    children: SerializedWidget[];
};

/**
 * Information about a connected GTKX application.
 */
export type AppInfo = {
    /** Application ID (e.g., "com.example.myapp") */
    applicationId: string;
    /** Process ID */
    pid: number;
};

/** Zod schema for app registration parameters. */
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
const widgetIdParams: z.ZodObject<{ widgetId: z.ZodString }, z.core.$strip> = z.object({ widgetId: z.string() });
const queryParams: z.ZodObject<
    {
        queryType: z.ZodEnum<{ role: "role"; text: "text"; name: "name"; labelText: "labelText" }>;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        options: z.ZodOptional<
            z.ZodObject<{ name: z.ZodOptional<z.ZodString>; exact: z.ZodOptional<z.ZodBoolean> }, z.core.$loose>
        >;
    },
    z.core.$strip
> = z.object({
    queryType: z.enum(["role", "text", "name", "labelText"]),
    value: z.union([z.string(), z.number()]),
    options: z.object({ name: z.string().optional(), exact: z.boolean().optional() }).loose().optional(),
});
const typeParams: z.ZodObject<
    { widgetId: z.ZodString; text: z.ZodString; clear: z.ZodOptional<z.ZodBoolean> },
    z.core.$strip
> = z.object({ widgetId: z.string(), text: z.string(), clear: z.boolean().optional() });
const fireEventParams: z.ZodObject<
    { widgetId: z.ZodString; signal: z.ZodString; args: z.ZodOptional<z.ZodArray<z.ZodUnknown>> },
    z.core.$strip
> = z.object({ widgetId: z.string(), signal: z.string(), args: z.array(z.unknown()).optional() });
const screenshotParams: z.ZodObject<{ windowId: z.ZodOptional<z.ZodString> }, z.core.$strip> = z.object({
    windowId: z.string().optional(),
});

/**
 * Per-method wire-payload schemas for every request the server forwards to a
 * connected app. The payloads are the post-mapper shapes the app receives
 * (`applicationId` stripped, `by` renamed to `queryType`), so an app validates
 * each request at its dispatch boundary against one shared contract.
 */
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

/**
 * The validated wire parameters of a server-initiated method, inferred from
 * {@link ServerRequestParamsSchemas}.
 *
 * @typeParam Method - A method present in {@link ServerRequestParamsSchemas}.
 */
export type ServerRequestParams<Method extends keyof typeof ServerRequestParamsSchemas> = z.infer<
    (typeof ServerRequestParamsSchemas)[Method]
>;

/**
 * The minimal validation surface a wire-parameter consumer depends on: the
 * `safeParse` entry point yielding either the parsed value or an error message.
 * Every {@link ServerRequestParamsSchemas} entry satisfies this, so a consumer
 * outside `@gtkx/mcp` can validate against the shared schemas without depending
 * on `zod` directly.
 *
 * @typeParam Output - The validated parameter type the schema produces.
 */
export type WireParamsSchema<Output> = {
    safeParse(
        value: unknown,
    ):
        | { readonly success: true; readonly data: Output }
        | { readonly success: false; readonly error: { readonly message: string } };
};

/**
 * Available IPC methods.
 */
export type IpcMethod =
    | "app.register"
    | "app.unregister"
    | "app.getWindows"
    | "widget.getTree"
    | "widget.query"
    | "widget.getProps"
    | "widget.click"
    | "widget.type"
    | "widget.fireEvent"
    | "widget.screenshot";

/**
 * Union type for any IPC message (request or response).
 */
export type IpcMessage = IpcRequest | IpcResponse;

/**
 * Gets the XDG runtime directory or falls back to system temp.
 *
 * @returns Path to the runtime directory
 */
const getRuntimeDir = (): string => process.env.XDG_RUNTIME_DIR ?? tmpdir();

/**
 * Default path for the MCP socket file.
 */
export const DEFAULT_SOCKET_PATH: string = join(getRuntimeDir(), "gtkx-mcp.sock");
