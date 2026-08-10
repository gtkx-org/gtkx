import { formatChildProcessError, resolveExecutable } from "@gtkx/utils";
import { execFileSync, type ExecFileSyncOptions } from "node:child_process";

type CliToolInvocation = {
    tool: string;
    args: string[];
    target?: string;
    shouldStream?: boolean;
    options?: ExecFileSyncOptions;
};

const streamingOptions = (options: ExecFileSyncOptions | undefined): ExecFileSyncOptions => ({
    ...options,
    stdio: "inherit",
});

const runCliTool = ({ tool, args, target, shouldStream, options }: CliToolInvocation): void => {
    const executable = resolveExecutable(tool);

    try {
        execFileSync(executable, args, shouldStream === true ? streamingOptions(options) : options);
    } catch (error) {
        const details = formatChildProcessError(error);
        const suffix = details ? `:\n${details}` : "";
        const subject = target === undefined ? "" : ` for ${target}`;

        throw new Error(`${tool} failed${subject}${suffix}`, { cause: error });
    }
};

export { runCliTool };
