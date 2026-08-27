import { info } from "@gtkx/utils";
import { defineCommand } from "citty";
import { cwdArg, resolveCwd } from "../internal/entry-arg.js";
import { type ClientName, type ClientResult, CLIENTS, isClientName, writeClientConfig } from "../mcp/client-config.js";

const clientList = CLIENTS.map((client) => client.name).join(", ");

const init = defineCommand({
    meta: {
        name: "init",
        description: "Write the gtkx MCP server into an editor's configuration file",
    },
    args: {
        client: {
            type: "string",
            description: `Which editor to configure: one of ${clientList}`,
            required: true,
        },
        ...cwdArg,
    },
    run({ args }) {
        const cwd = resolveCwd(args);
        const name = args.client;

        if (!isClientName(name)) {
            throw new Error(`Unknown --client "${name}". Pass one of ${clientList}.`);
        }

        report(name, writeClientConfig(cwd, name));
    },
});

const mcp = defineCommand({
    meta: {
        name: "mcp",
        description: "Run the MCP server that exposes this project's running app and generated API reference",
    },
    args: {
        tools: {
            type: "string",
            description:
                "Comma-separated tool name patterns to register, `*` matching any run of characters and a " +
                "leading `!` excluding. Overrides `mcp.tools` in gtkx.config.ts",
        },
        "read-only": {
            type: "boolean",
            description: "Register only the tools that read state, leaving out the ones that drive the app",
        },
        ...cwdArg,
    },
    subCommands: { init },
    async run({ args }) {
        const { runMcpServer } = await import("@gtkx/mcp/server");

        await runMcpServer({
            cwd: resolveCwd(args),
            ...(args.tools !== undefined && { tools: splitPatterns(args.tools) }),
            ...(args["read-only"] !== undefined && { isReadOnly: args["read-only"] }),
        });
    },
});

const splitPatterns = (value: string): string[] =>
    value.split(",").map((pattern) => pattern.trim()).filter((pattern) => pattern.length > 0);

const report = (name: ClientName, result: ClientResult): void => {
    if (result.kind === "manual") {
        info(`mcp: ${name} keeps its servers in ${result.path}, which is outside this project. Add:`);

        for (const line of result.snippet.split("\n")) {
            info(`mcp:   ${line}`);
        }

        return;
    }

    info(`mcp: ${result.isCreated ? "created" : "updated"} ${result.path} for ${name}`);
    info("mcp: restart the editor for it to pick the server up");
};

export { mcp };
