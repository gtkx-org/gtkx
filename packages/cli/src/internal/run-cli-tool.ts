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

const optionsFor = (shouldStream: boolean | undefined, options: ExecFileSyncOptions | undefined): ExecFileSyncOptions |
    undefined => (shouldStream === true ? streamingOptions(options) : options);

const failureMessage = (tool: string, target: string | undefined, error: unknown): string => {
    const details = formatChildProcessError(error);
    const suffix = details ? `:\n${details}` : "";
    const subject = target === undefined ? "" : ` for ${target}`;

    return `${tool} failed${subject}${suffix}`;
};

const runCliTool = ({ tool, args, target, shouldStream, options }: CliToolInvocation): void => {
    const executable = resolveExecutable(tool);

    try {
        execFileSync(executable, args, optionsFor(shouldStream, options));
    } catch (error) {
        throw new Error(failureMessage(tool, target, error), { cause: error });
    }
};

export { runCliTool };
