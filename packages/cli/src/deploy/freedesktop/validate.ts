import { formatChildProcessError, resolveExecutable, warn } from "@gtkx/utils";
import { execFileSync } from "node:child_process";

type ValidationRequest = {
    tool: string;
    args: string[];
    subject: string;
};

const DIAGNOSTIC_PREFIX = /^[EIPW]:/;

const runValidator = ({ tool, args, subject }: ValidationRequest): string => {
    const executable = resolveExecutable(tool);

    try {
        return execFileSync(executable, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    } catch (error) {
        throw new Error(`${subject} is not valid:\n${formatChildProcessError(error) ?? "no output"}`, { cause: error });
    }
};

const validateDesktopEntry = (path: string): void => {
    const output = runValidator({
        tool: "desktop-file-validate",
        args: [path],
        subject: "The desktop entry",
    });

    if (output.length > 0) {
        throw new Error(`The desktop entry is not valid:\n${output}`);
    }
};

const validateMetainfo = (path: string): void => {
    const output = runValidator({
        tool: "appstreamcli",
        args: ["validate", "--no-net", "--explain", path],
        subject: "The AppStream metainfo",
    });

    const diagnostics = output.split("\n").filter((entry) => DIAGNOSTIC_PREFIX.test(entry));

    for (const line of diagnostics) {
        warn(`AppStream metainfo: ${line.trim()}`);
    }
};

export { validateDesktopEntry, validateMetainfo };
