import which from "which";

const tryResolveExecutable = (command: string): string | undefined =>
    which.sync(command, { nothrow: true }) ?? undefined;

const resolveExecutable = (command: string): string => which.sync(command);

export { resolveExecutable, tryResolveExecutable };
