import { BroadcastChannel } from "node:worker_threads";

const WORKER_SOURCES_CHANNEL = "gtkx:worker-sources";

const openWorkerSources = (): BroadcastChannel => {
    const channel = new BroadcastChannel(WORKER_SOURCES_CHANNEL);
    channel.unref();

    return channel;
};

export { openWorkerSources };
