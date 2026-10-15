const MAX_TIMER_DELAY = 2_147_483_647;

let timer: NodeJS.Timeout | undefined;
let stopped = false;

const keepAlive = (enable: boolean): void => {
    if (stopped) {
        return;
    }

    if (enable) {
        timer ??= setInterval(() => {}, MAX_TIMER_DELAY);
    } else {
        clearInterval(timer);
        timer = undefined;
    }
};

const stopKeepingAlive = (): void => {
    keepAlive(false);
    stopped = true;
};

export { keepAlive, stopKeepingAlive };
