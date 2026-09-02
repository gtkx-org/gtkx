import { MCP_SOCKET_PATH_ENV, resolveMcpSocketPath } from "@gtkx/mcp/internal";
import { resolveHeadlessOptions, startHeadlessDisplay } from "@gtkx/vitest/headless";

const restoreEnvironment = (name: string, value: string | undefined): void => {
    if (value === undefined) {
        Reflect.deleteProperty(process.env, name);
    } else {
        process.env[name] = value;
    }
};

const startHeadlessDevDisplay = async (size?: string): Promise<() => void> => {
    const previousSocketPath = process.env[MCP_SOCKET_PATH_ENV];
    process.env[MCP_SOCKET_PATH_ENV] = resolveMcpSocketPath();

    try {
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ ...(size !== undefined && { size }) }));
        let isStopped = false;

        const stop = (): void => {
            if (isStopped) {
                return;
            }

            isStopped = true;
            process.removeListener("exit", stop);
            stopDisplay();
            restoreEnvironment(MCP_SOCKET_PATH_ENV, previousSocketPath);
        };

        process.once("exit", stop);

        return stop;
    } catch (error) {
        restoreEnvironment(MCP_SOCKET_PATH_ENV, previousSocketPath);
        throw error;
    }
};

export { startHeadlessDevDisplay };
