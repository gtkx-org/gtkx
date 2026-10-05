import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import {
    compileNativeFixture,
    isolateTypeConsumer,
    runNativeConsumer,
    typecheckSource,
} from "./type-consumer.js";

const FIXTURE = fileURLToPath(new URL("fixtures/throwing-hook.c", import.meta.url));
const CONSUMER = `import assert from "node:assert/strict";
import { type HookFunc, type PlainFunc, Runner } from "@gtkx/gi/throwinghook";
import { quit } from "@gtkx/runtime";

const runner = new Runner();
const seen: string[] = [];
const plainSeen: string[] = [];
const hook: HookFunc = (text) => {
    seen.push(text);
    if (text === "throw") {
        throw new Error();
    }
    return text !== "decline";
};
const plain: PlainFunc = (text) => {
    plainSeen.push(text);
    if (text === "throw") {
        throw new Error();
    }
    return text.length > 0;
};

try {
    runner.setHook(hook);
    assert.equal(runner.runHook("\u{FEFF}café ♥"), true);
    assert.equal(runner.runHook("decline"), false);
    assert.throws(() => runner.runHook("throw"));
    assert.equal(runner.tryHook("throw"), 2);
    assert.equal(runner.tryHook("accept"), 0);
    assert.equal(runner.tryHook("decline"), 1);
    runner.setHook((text) => text === "replacement");
    assert.equal(runner.tryHook("replacement"), 0);
    assert.deepEqual(seen, ["\u{FEFF}café ♥", "decline", "throw", "throw", "accept", "decline"]);

    runner.setPlain(plain);
    assert.equal(runner.runPlain("plain"), true);
    assert.equal(runner.runPlain(""), false);
    assert.throws(() => runner.runPlain("throw"));
    assert.equal(runner.runPlain("recovered"), true);
    runner.setPlain((text) => text === "replacement");
    assert.equal(runner.runPlain("replacement"), true);
    assert.deepEqual(plainSeen, ["plain", "", "throw", "recovered"]);

    runner.clearHooks();
    runner.setHook((text) => text === "reinstalled");
    runner.setPlain((text) => text === "reinstalled");
    assert.equal(runner.runHook("reinstalled"), true);
    assert.equal(runner.runPlain("reinstalled"), true);
} finally {
    runner.clearHooks();
    quit();
}
`;
const SIGNATURES = `import type { HookFunc, PlainFunc, Runner } from "@gtkx/gi/throwinghook";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
export const signatures: [
    Expect<Equal<Parameters<HookFunc>, [string]>>,
    Expect<Equal<ReturnType<HookFunc>, boolean>>,
    Expect<Equal<Parameters<PlainFunc>, [string]>>,
    Expect<Equal<ReturnType<PlainFunc>, boolean>>,
    Expect<Equal<Parameters<Runner["runHook"]>, [string]>>,
    Expect<Equal<ReturnType<Runner["runHook"]>, boolean>>,
    Expect<Equal<ReturnType<Runner["tryHook"]>, number>>,
] = [true, true, true, true, true, true, true];
`;
const REJECTED = [
    "runner.setHook((text: number) => text > 0);",
    "runner.setPlain(() => 42);",
    "runner.setHook((text: string, error: Error) => text.length > 0);",
    "runner.setPlain((text: string, data: object) => text.length > 0);",
    "runner.runHook(5);",
    "runner.runPlain();",
];

describe("generated callbacks with native error boundaries", () => {
    it("runs throwing and plain callbacks with their public signatures", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-throws-",
            config: fixtureConfig("ThrowingHook-1.0"),
            files: { "probe.ts": CONSUMER },
        });
        expect(runCli(project, ["codegen"]).status).toBe(0);
        compileNativeFixture(project, FIXTURE, "libthrowinghook.so.0", "gobject-2.0");
        expect(() => {
            runNativeConsumer(project);
        }).not.toThrow();
        isolateTypeConsumer(project);
        expect(typecheckSource(project, CONSUMER)).toBe(0);
        expect(typecheckSource(project, SIGNATURES)).toBe(0);

        for (const source of REJECTED) {
            expect(typecheckSource(project,
                `import { Runner } from "@gtkx/gi/throwinghook";\nconst runner = new Runner();\n${source}`,
            )).not.toBe(0);
        }
    });

    it("fails codegen for a library whose GIR file is absent", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-throws-broken-",
            config: fixtureConfig("ThrowingHookAbsent-1.0"),
        });

        expect(runCli(project, ["codegen"]).status).not.toBe(0);
    });
});
