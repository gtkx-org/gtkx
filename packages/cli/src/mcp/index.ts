import { McpClient } from "./client.js";

let globalClient: McpClient | null = null;

/**
 * Starts (or reuses) the singleton MCP client for the current process.
 *
 * @param appId - The GTK application ID to register with the server.
 * @returns The configured {@link McpClient}, connected or in the middle of
 *   its reconnect cycle.
 */
export const startMcpClient = async (appId: string): Promise<McpClient> => {
    if (globalClient) {
        return globalClient;
    }

    globalClient = new McpClient({ appId });

    await globalClient.connect().catch(() => {});

    return globalClient;
};

/**
 * Stops the singleton MCP client, if one is running.
 */
export const stopMcpClient = (): void => {
    if (globalClient) {
        globalClient.disconnect();
        globalClient = null;
    }
};

export { McpClient } from "./client.js";
