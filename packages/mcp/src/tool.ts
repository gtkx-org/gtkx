import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { ProtocolError } from "./protocol/errors.js";

type ToolArgs<Shape extends Record<string, z.ZodType>> = { [K in keyof Shape]: z.output<Shape[K]> };
type ToolKind = "readOnly" | "action";

type Tool<Shape extends Record<string, z.ZodType> = Record<string, z.ZodType>> = {
    name: string;
    title: string;
    kind: ToolKind;
    description: string;
    inputSchema: Shape;
    isOpenWorld?: boolean;
    handler: (args: ToolArgs<Shape>) => Promise<CallToolResult>;
};

const textContent = (text: string): CallToolResult => ({ content: [{ type: "text", text }] });

const textError = (text: string): CallToolResult => ({
    content: [{ type: "text", text }],
    isError: true,
});

const imageContent = (data: string, mimeType: string): CallToolResult => ({
    content: [{ type: "image", data, mimeType }],
});

const hasStringHint = (data: unknown): data is { hint: string } =>
    typeof data === "object" && data !== null && "hint" in data && typeof data.hint === "string";

const errorToResult = (error: unknown): CallToolResult => {
    if (error instanceof ProtocolError) {
        return textError(hasStringHint(error.data) ? `${error.message}\n${error.data.hint}` : error.message);
    }

    return textError(error instanceof Error ? error.message : String(error));
};

const runTool = async (
    handler: (args: ToolArgs<Record<string, z.ZodType>>) => Promise<CallToolResult>,
    args: ToolArgs<Record<string, z.ZodType>>,
): Promise<CallToolResult> => {
    try {
        return await handler(args);
    } catch (error) {
        return errorToResult(error);
    }
};

const defineTool = <Shape extends Record<string, z.ZodType>>(tool: Tool<Shape>): Tool => tool as Tool;

const registerTool = (server: McpServer, tool: Tool): void => {
    const callback = ((args: ToolArgs<Record<string, z.ZodType>>) =>
        runTool(tool.handler, args)) as ToolCallback<Record<string, z.ZodType>>;

    server.registerTool(
        tool.name,
        {
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: {
                title: tool.title,
                readOnlyHint: tool.kind === "readOnly",
                destructiveHint: tool.kind === "action",
                openWorldHint: tool.isOpenWorld === true,
            },
        },
        callback,
    );
};

export { textContent, textError, imageContent, defineTool, registerTool, type ToolArgs, type Tool };
