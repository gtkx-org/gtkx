const GRACEFUL_DELAY_MS = 200;

let firstSignal = null;
let exited = false;

const finish = (graceful) => {
    if (exited) return;
    exited = true;
    const code = graceful ? 0 : firstSignal === "SIGINT" ? 130 : 143;
    process.exit(code);
};

const handle = (signal) => {
    process.stdout.write(`SIGRECV ${signal}\n`);
    if (firstSignal === null) {
        firstSignal = signal;
        Promise.resolve()
            .then(() => new Promise((resolve) => setTimeout(resolve, GRACEFUL_DELAY_MS)))
            .then(
                () => finish(true),
                () => finish(false),
            );
        return;
    }
    finish(false);
};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => handle(signal));

setInterval(() => {}, 1 << 30);
process.stdout.write("CHILD_READY\n");
