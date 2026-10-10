import { McpClient } from "./client.js";

type McpClientController = {
    start: (applicationId: string, socketPath?: string) => Promise<McpClient>;
    stop: () => void;
};

const { start: startMcpClient, stop: stopMcpClient } = createMcpClientController();

async function connectQuietly(client: McpClient): Promise<boolean> {
    try {
        await client.connect();

        return true;
    } catch {
        return false;
    }
}

function createMcpClientController(): McpClientController {
    let current: McpClient | null = null;

    return {
        start: async (applicationId: string, socketPath?: string): Promise<McpClient> => {
            if (current) {
                return current;
            }

            const client = new McpClient({ applicationId, ...(socketPath !== undefined && { socketPath }) });
            current = client;
            await connectQuietly(client);

            return client;
        },
        stop: (): void => {
            if (!current) {
                return;
            }

            current.disconnect();
            current = null;
        },
    };
}

export { startMcpClient, stopMcpClient };
