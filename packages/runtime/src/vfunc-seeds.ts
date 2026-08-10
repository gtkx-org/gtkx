import type { Descriptor } from "@gtkx/native";

type RefSeeds = Map<number, unknown>;

type SeedFrame = {
    argDescriptors: Descriptor[];
    instance: unknown;
    seeds: RefSeeds;
};

const frames: SeedFrame[] = [];

const pushSeedFrame = (frame: SeedFrame): void => {
    frames.push(frame);
};

const popSeedFrame = (): void => {
    frames.pop();
};

const isMatchingFrame = (frame: SeedFrame, argDescriptors: Descriptor[], instance: unknown): boolean =>
    frame.argDescriptors === argDescriptors && frame.instance === instance;

const seedsFor = (argDescriptors: Descriptor[], instance: unknown): RefSeeds | undefined => {
    for (let index = frames.length - 1; index >= 0; index--) {
        const frame = frames[index];

        if (frame !== undefined && isMatchingFrame(frame, argDescriptors, instance)) {
            return frame.seeds;
        }
    }

    return undefined;
};

export { popSeedFrame, pushSeedFrame, type RefSeeds, seedsFor };
