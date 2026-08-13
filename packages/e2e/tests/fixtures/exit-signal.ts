import { onExit } from "@gtkx/runtime";

const HOLD_TIMEOUT_MS = 60_000;
const HANDLED_MODE = "handled";
const HANDLED_EXIT_CODE = 7;

const holdProcess = (): void => {
    setTimeout(() => {
        process.stdout.write("HELD TOO LONG\n");
    }, HOLD_TIMEOUT_MS);
};

const takeOverSignal = (): void => {
    process.on("SIGTERM", () => {
        process.exit(HANDLED_EXIT_CODE);
    });
};

const announceExit = (): void => {
    process.stdout.write("ONEXIT RAN\n");
};

const start = (mode: string): void => {
    onExit(announceExit);

    if (mode === HANDLED_MODE) {
        takeOverSignal();
    }

    process.stdout.write("READY\n");
    holdProcess();
};

start(process.argv[2] ?? "");
