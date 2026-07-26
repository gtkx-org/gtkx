const GRACEFUL_DELAY_MS = 200;
let firstSignal = null;
let exited = false;

const interruptedCode = () => (firstSignal === "SIGINT" ? 130 : 143);

const finish = (graceful) => {
    if (exited) return;
    exited = true;
    process.exit(graceful ? 0 : interruptedCode());
};

const finishAfterDelay = async () => {
    try {
        await new Promise((resolve) => setTimeout(resolve, GRACEFUL_DELAY_MS));
    } catch {
        finish(false);
        return;
    }

    finish(true);
};

const handle = (signal) => {
    process.stdout.write(`SIGRECV ${signal}\n`);

    if (firstSignal === null) {
        firstSignal = signal;
        void finishAfterDelay();
        return;
    }

    finish(false);
};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => handle(signal));
setInterval(() => {}, 1 << 30);
process.stdout.write("CHILD_READY\n");
