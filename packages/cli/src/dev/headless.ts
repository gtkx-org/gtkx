import { resolveMcpSocketPath } from "@gtkx/mcp/internal";
import { resolveHeadlessOptions, startHeadlessDisplay } from "@gtkx/vitest/headless";

type HeadlessDevDisplay = {
    stop: () => void;
    mcpSocketPath: string;
};

const startHeadlessDevDisplay = async (size?: string): Promise<HeadlessDevDisplay> => {
    const mcpSocketPath = resolveMcpSocketPath();
    const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ ...(size !== undefined && { size }) }));
    let isStopped = false;

    const stop = (): void => {
        if (isStopped) {
            return;
        }

        isStopped = true;
        process.removeListener("exit", stop);
        stopDisplay();
    };

    process.once("exit", stop);

    return { stop, mcpSocketPath };
};

export { startHeadlessDevDisplay };
