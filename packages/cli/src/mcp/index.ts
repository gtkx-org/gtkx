import { McpClient } from "./client.js";

let globalClient: McpClient | null = null;

export const startMcpClient = async (applicationId: string): Promise<McpClient> => {
    if (globalClient) {
        return globalClient;
    }

    globalClient = new McpClient({ applicationId });

    await globalClient.connect().catch(() => undefined);

    return globalClient;
};

export const stopMcpClient = (): void => {
    if (!globalClient) {
        return;
    }

    globalClient.disconnect();
    globalClient = null;
};
