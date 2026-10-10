import { isRecord, normalizeError } from "@gtkx/utils";

type DevRunnerBootstrap = {
    entryPath: string;
    configFile: string;
    storybookConfig?: string | undefined;
    mcpSocketPath?: string | undefined;
};

const DEV_RUNNER_READY = "gtkx:dev-ready";

const parseBootstrap = (message: unknown): DevRunnerBootstrap => {
    if (
        !isRecord(message) ||
        typeof message.entryPath !== "string" ||
        message.entryPath.length === 0 ||
        typeof message.configFile !== "string" ||
        message.configFile.length === 0 ||
        (message.storybookConfig !== undefined && typeof message.storybookConfig !== "string") ||
        (message.mcpSocketPath !== undefined && typeof message.mcpSocketPath !== "string")
    ) {
        throw new Error("Invalid dev runner startup options");
    }

    return {
        entryPath: message.entryPath,
        configFile: message.configFile,
        storybookConfig: message.storybookConfig,
        mcpSocketPath: message.mcpSocketPath,
    };
};

const receiveDevRunnerBootstrap = (): Promise<DevRunnerBootstrap> =>
    new Promise((resolve, reject) => {
        if (process.send === undefined || !process.connected) {
            reject(new Error("The dev runner must be started by gtkx dev or gtkx storybook"));

            return;
        }

        process.once("message", (message: unknown) => {
            try {
                resolve(parseBootstrap(message));
            } catch (error) {
                reject(normalizeError(error));
            }
        });
        process.send(DEV_RUNNER_READY, (error) => {
            if (error !== null) {
                reject(error);
            }
        });
    });

export { DEV_RUNNER_READY, receiveDevRunnerBootstrap, type DevRunnerBootstrap };
