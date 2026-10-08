import { bind } from "@gtkx/native";
import { expect, test } from "vitest";

test("native callback completion retention requires a userdata companion", () => {
    expect(() =>
        bind(
            "libgtkx-missing-callback-fixture.so",
            "gtkx_callback",
            [
                {
                    kind: "callback",
                    argDescriptors: [],
                    returnDescriptor: { kind: "int32" },
                    canThrow: true,
                    scope: "forever",
                    releaseWithCompletion: true,
                },
            ],
            { kind: "void" },
        ),
    ).toThrow();
});
