type MarshallingConsumer = {
    title: string;
    library: string;
    imports: string;
    accepted: string;
    rejected: string[];
};

const EXACT_TYPES = `type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
    (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
`;

const MARSHALLING_CONSUMERS: MarshallingConsumer[] = [
    {
        title: "represents byte sequences as typed arrays",
        library: "ByteSeq-1.0",
        imports: `${EXACT_TYPES}import type { Blob } from "@gtkx/gi/byteseq";
declare const blob: Blob;
`,
        accepted: `blob.writeSized(new Uint8Array([0, 128, 255]));
blob.writeSized([0, 128, 255]);
blob.writeSized([]);
export const signatures: [
    Expect<Equal<ReturnType<Blob["readSized"]>, Uint8Array>>,
    Expect<Equal<ReturnType<Blob["readByteArray"]>, Uint8Array>>,
    Expect<Equal<ReturnType<Blob["readNumbers"]>, number[]>>,
    Expect<Equal<ReturnType<Blob["writeSized"]>, void>>,
] = [true, true, true, true];
`,
        rejected: [
            'blob.writeSized(["invalid"]);',
            "export const numbers: number[] = blob.readSized();",
            "export const bytes: Uint8Array = blob.readNumbers();",
        ],
    },
    {
        title: "accepts JavaScript values and unwraps returned GValues",
        library: "ValueBox-1.0",
        imports: `${EXACT_TYPES}import type { Value } from "@gtkx/gi/gobject";
import type { Holder } from "@gtkx/gi/valuebox";
import type { JsValue } from "@gtkx/runtime";
declare const holder: Holder;
declare const value: Value;
`,
        accepted: `holder.store(value);
holder.store(42);
holder.store("stored");
holder.storeMaybe(null);
holder.storeMaybe(value);
holder.storeAll([value, 42, "stored", true]);
holder.storeAll([]);
holder.fillInPlace(value);
export const signatures: [
    Expect<Equal<Parameters<Holder["store"]>, [value: Value | JsValue]>>,
    Expect<Equal<Parameters<Holder["storeMaybe"]>, [value: Value | JsValue | null]>>,
    Expect<Equal<Parameters<Holder["storeAll"]>, [values: (Value | JsValue)[]]>>,
    Expect<Equal<Parameters<Holder["fillInPlace"]>, [value: Value]>>,
    Expect<Equal<ReturnType<Holder["peek"]>, unknown>>,
    Expect<Equal<ReturnType<Holder["fill"]>, [boolean, unknown]>>,
] = [true, true, true, true, true, true];
`,
        rejected: [
            "holder.store({});",
            "holder.storeAll([() => 1]);",
            "holder.fillInPlace(42);",
            "export const returned: Value = holder.peek();",
        ],
    },
    {
        title: "trims the leading success value from finish results",
        library: "AsyncPair-1.0",
        imports: `${EXACT_TYPES}import { Job, queryAsync } from "@gtkx/gi/asyncpair";
declare const job: Job;
`,
        accepted: `export const run: Promise<[string, number]> = job.runAsync();
export const probe: Promise<boolean> = job.probeAsync();
export const created: Promise<Job> = Job.createAsync(true);
export const queried: Promise<number> = queryAsync(true);
export const signatures: [
    Expect<Equal<ReturnType<Job["runAsync"]>, Promise<[string, number]>>>,
    Expect<Equal<ReturnType<Job["probeAsync"]>, Promise<boolean>>>,
    Expect<Equal<ReturnType<typeof Job.createAsync>, Promise<Job>>>,
    Expect<Equal<ReturnType<typeof queryAsync>, Promise<number>>>,
] = [true, true, true, true];
`,
        rejected: [
            "export const result: Promise<[boolean, string, number]> = job.runAsync();",
            "export const result: Promise<void> = job.probeAsync();",
            "job.runAsync(() => undefined);",
            "Job.createAsync();",
            "queryAsync(true, () => undefined);",
            "export const result: Promise<void> = queryAsync(true);",
        ],
    },
    {
        title: "pairs an externally annotated async method with its class's only generic finish",
        library: "AsyncPair-1.0",
        imports: `${EXACT_TYPES}import type { Cancellable } from "@gtkx/gi/gio";
import type { Sack } from "@gtkx/gi/asyncpair";
declare const sack: Sack;
declare const cancellable: Cancellable;
`,
        accepted: `export const operations: Promise<boolean>[] = [
    sack.fetchAsync(), sack.fetchAsync(null), sack.fetchAsync(cancellable),
    sack.refreshAsync(), sack.refreshAsync(null), sack.refreshAsync(cancellable),
];
export const signatures: [
    Expect<Equal<Parameters<Sack["fetchAsync"]>, [cancellable?: Cancellable | null]>>,
    Expect<Equal<Parameters<Sack["refreshAsync"]>, [cancellable?: Cancellable | null]>>,
    Expect<Equal<ReturnType<Sack["fetchAsync"]>, Promise<boolean>>>,
    Expect<Equal<ReturnType<Sack["refreshAsync"]>, Promise<boolean>>>,
] = [true, true, true, true];
`,
        rejected: [
            "sack.fetchAsync(null, () => undefined);",
            "sack.refreshAsync(null, () => undefined);",
            "export const result: void = sack.fetchAsync();",
        ],
    },
    {
        title: "keeps the callback form when no finish method of the class can be paired",
        library: "AsyncPair-1.0",
        imports: `${EXACT_TYPES}import type { AsyncReadyCallback, Cancellable } from "@gtkx/gi/gio";
import type { Job, Pool } from "@gtkx/gi/asyncpair";
declare const job: Job;
declare const pool: Pool;
declare const callback: AsyncReadyCallback;
declare const cancellable: Cancellable;
`,
        accepted: `job.externalAsync(callback);
job.externalAsync(null);
pool.drainAsync(cancellable, callback);
pool.drainAsync(null, null);
export const signatures: [
    Expect<Equal<Parameters<Job["externalAsync"]>, [callback: AsyncReadyCallback | null]>>,
    Expect<Equal<
        Parameters<Pool["drainAsync"]>,
        [cancellable: Cancellable | null, callback: AsyncReadyCallback | null]
    >>,
    Expect<Equal<ReturnType<Job["externalAsync"]>, void>>,
    Expect<Equal<ReturnType<Pool["drainAsync"]>, void>>,
] = [true, true, true, true];
`,
        rejected: [
            "job.externalAsync();",
            "pool.drainAsync(null);",
            "export const result: Promise<boolean> = job.externalAsync(callback);",
            "export const result: Promise<boolean> = pool.drainAsync(null, callback);",
        ],
    },
    {
        title: "mutates caller-allocated inout records without returning them again",
        library: "InoutBox-1.0",
        imports: `${EXACT_TYPES}import type { Spot, Walker } from "@gtkx/gi/inoutbox";
declare const walker: Walker;
declare const spot: Spot;
`,
        accepted: `export const stepped: boolean = walker.step(spot);
walker.recenter(spot);
export const located: [boolean, string] = walker.locate(spot);
export const advanced: [boolean, number] = walker.advance(2);
export const signatures: [
    Expect<Equal<ReturnType<Walker["step"]>, boolean>>,
    Expect<Equal<ReturnType<Walker["recenter"]>, void>>,
    Expect<Equal<ReturnType<Walker["locate"]>, [boolean, string]>>,
    Expect<Equal<ReturnType<Walker["advance"]>, [boolean, number]>>,
] = [true, true, true, true];
`,
        rejected: [
            "walker.step();",
            "walker.recenter(null);",
            "export const result: [boolean, Spot] = walker.step(spot);",
            "export const result: Spot = walker.recenter(spot);",
            "export const result: [boolean, Spot, string] = walker.locate(spot);",
            "walker.advance(spot);",
        ],
    },
];

export { MARSHALLING_CONSUMERS };
