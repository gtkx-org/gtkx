import { McpClient } from "./client.js";

let globalClient: McpClient | null = null;

const connectQuietly = async (client: McpClient): Promise<boolean> => {
    try {
        await client.connect();
        return true;
    } catch {
        return false;
    }
};

export const startMcpClient = async (applicationId: string): Promise<McpClient> => {
    if (globalClient) {
        return globalClient;
    }

    const client = new McpClient({ applicationId });
    globalClient = client;

    await connectQuietly(client);

    return client;
};

export const stopMcpClient = (): void => {
    if (!globalClient) {
        return;
    }

    globalClient.disconnect();
    globalClient = null;
};
