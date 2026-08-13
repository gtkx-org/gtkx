import type { ChildProcess } from "node:child_process";

type MarkerWait = {
    child: ChildProcess;
    read: () => string;
    marker: string;
    subject: string;
    timeoutMs: number;
};

const collectOutput = (child: ChildProcess): (() => string) => {
    let buffer = "";

    const append = (chunk: Buffer): void => {
        buffer += chunk.toString();
    };

    child.stdout?.on("data", append);
    child.stderr?.on("data", append);

    return () => buffer;
};

const waitForMarker = ({ child, read, marker, subject, timeoutMs }: MarkerWait): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${subject} never printed "${marker}":\n${read()}`));
        }, timeoutMs);

        child.stdout?.on("data", () => {
            if (!read().includes(marker)) {
                return;
            }

            clearTimeout(timer);
            resolve();
        });

        child.once("exit", () => {
            clearTimeout(timer);
            reject(new Error(`${subject} exited before it printed "${marker}":\n${read()}`));
        });
    });

export { collectOutput, waitForMarker };
