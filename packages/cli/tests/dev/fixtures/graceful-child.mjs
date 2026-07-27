const GRACEFUL_DELAY_MS = 200;
const KEEP_ALIVE_MS = 1 << 30;
const HANDLED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
const keepAlive = setInterval(emitHeartbeat, KEEP_ALIVE_MS);
const state = { firstSignal: null, isExited: false };

function emitHeartbeat() {
    process.stdout.write("HEARTBEAT\n");
}

const interruptedCode = () => (state.firstSignal === "SIGINT" ? 130 : 143);

const finish = (isGraceful) => {
    if (state.isExited) {
        return;
    }

    state.isExited = true;
    clearInterval(keepAlive);
    process.exitCode = isGraceful ? 0 : interruptedCode();
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

    if (state.firstSignal === null) {
        state.firstSignal = signal;
        void finishAfterDelay();

        return;
    }

    finish(false);
};

for (const signal of HANDLED_SIGNALS) {
    process.on(signal, () => handle(signal));
}

process.stdout.write("CHILD_READY\n");
