import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { describe, expect, it } from "vitest";
import { createCallerContainerProject } from "./codegen-caller-containers-fixture.js";

describe("generated caller-allocated platform container references", () => {
    it("omits caller-allocated C-array slots while retaining owned-byte reads and adjacent supported slots", () => {
        using project = createCallerContainerProject("gtkx-cli-caller-platform-reference-", {});
        const reference = loadApiReference({
            libraries: ["Gio-2.0", "Pango-1.0"],
            girPath: resolveGirPath([]),
            resolveFrom: project.root,
        });
        const pollable = reference.lookup("Gio.PollableInputStream", "interface");
        expect(pollable.outcome).toBe("page");
        expect(pollable).toHaveProperty("markdown", expect.not.stringContaining("### `vfuncReadNonblocking`"));
        expect(pollable).toHaveProperty("markdown", expect.stringContaining("### `vfuncIsReadable`"));
        const stream = reference.lookup("Gio.InputStream", "class");
        expect(stream.outcome).toBe("page");
        expect(stream).toHaveProperty("markdown", expect.not.stringContaining("### `vfuncReadAsync`"));
        expect(stream).toHaveProperty("markdown", expect.stringContaining("### `vfuncReadFinish`"));
        expect(stream).toHaveProperty("markdown", expect.stringContaining("### `readBytes`"));
        expect(stream).toHaveProperty("markdown", expect.stringContaining("### `readBytesAsync`"));
        const font = reference.lookup("Pango.Font", "class");
        expect(font.outcome).toBe("page");
        expect(font).toHaveProperty("markdown", expect.not.stringContaining("### `vfuncGetFeatures`"));
        expect(font).toHaveProperty("markdown", expect.stringContaining("### `vfuncGetMetrics`"));
    });
});
