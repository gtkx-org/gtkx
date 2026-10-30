import { errorMessage } from "@gtkx/utils";
import { McpClient } from "./client.js";
import type { TestingModuleLoader } from "./testing-loader.js";

type McpClientController = {
    start: (
        applicationId: string,
        loadTesting: TestingModuleLoader,
        reportUncaughtError: (cause: unknown) => void,
        socketPath?: string,
    ) => Promise<McpClient>;
    stop: () => void;
    reportApplicationError: (cause: unknown) => void;
};

const {
    start: startMcpClient,
    stop: stopMcpClient,
    reportApplicationError: reportMcpApplicationError,
} = createMcpClientController();

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
    let applicationError: string | null = null;

    return {
        start: async (
            applicationId: string,
            loadTesting: TestingModuleLoader,
            reportUncaughtError: (cause: unknown) => void,
            socketPath?: string,
        ): Promise<McpClient> => {
            if (current) {
                return current;
            }

            const client = new McpClient({
                applicationId,
                lastApplicationError: () => applicationError,
                loadTesting,
                reportUncaughtError,
                ...(socketPath !== undefined && { socketPath }),
            });
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
        reportApplicationError: (cause: unknown): void => {
            applicationError = errorMessage(cause);
        },
    };
}

export { reportMcpApplicationError, startMcpClient, stopMcpClient };
