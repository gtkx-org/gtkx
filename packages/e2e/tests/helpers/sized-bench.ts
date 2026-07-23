import { bench, describe } from "vitest";

export const describeSizedBench = (
    title: string,
    sizes: number[],
    name: (n: number) => string,
    run: (n: number) => Promise<void>,
): void => {
    describe(title, () => {
        for (const n of sizes) {
            bench(name(n), () => run(n));
        }
    });
};
