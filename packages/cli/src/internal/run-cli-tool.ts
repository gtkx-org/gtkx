import { formatChildProcessError, resolveExecutable } from "@gtkx/utils";
import { execFileSync, type ExecFileSyncOptions } from "node:child_process";

type CliToolInvocation = {
    tool: string;
    args: string[];
    target?: string;
    options?: ExecFileSyncOptions;
};

const runCliTool = ({ tool, args, target, options }: CliToolInvocation): void => {
    try {
        execFileSync(resolveExecutable(tool), args, options);
    } catch (error) {
        const details = formatChildProcessError(error);
        const suffix = details ? `:\n${details}` : "";
        const subject = target === undefined ? "" : ` for ${target}`;
        throw new Error(`${tool} failed${subject}${suffix}`, { cause: error });
    }
};

export { runCliTool };
