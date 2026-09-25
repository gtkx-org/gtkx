import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { describe, expect, it } from "vitest";
import {
    createCallerContainerProject,
    OMITTED_CALLBACKS,
    OMITTED_METHODS,
} from "./codegen-caller-containers-fixture.js";

describe("generated caller-allocated container admission references", () => {
    it("omits unsupported callback and vfunc entries while retaining supported contracts", () => {
        using project = createCallerContainerProject("gtkx-cli-caller-reference-", {});
        const reference = loadApiReference({
            libraries: ["CallerContainers-1.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
        for (const name of OMITTED_CALLBACKS) {
            expect(reference.lookup(`CallerContainers.${name}`).outcome).toBe("notFound");
        }
        const probe = reference.lookup("CallerContainers.Probe", "class");
        expect(probe.outcome).toBe("page");
        for (const name of OMITTED_METHODS) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        expect(probe).toHaveProperty("markdown", expect.stringContaining("### `vfuncAccept`"));
        expect(reference.lookup("CallerContainers.Input", "callback").outcome).toBe("page");
        expect(reference.lookup("CallerContainers.ByteInput", "callback").outcome).toBe("page");
        expect(reference.lookup("CallerContainers.fillFixed", "function").outcome).toBe("page");
        expect(reference.lookup("CallerContainers.fillRecord", "function").outcome).toBe("page");
        const icon = reference.lookup("Gio.Icon", "interface");
        expect(icon.outcome).toBe("page");
        expect(icon).toHaveProperty("markdown", expect.not.stringContaining("### `vfuncToTokens`"));
        expect(icon).toHaveProperty("markdown", expect.stringContaining("### `vfuncSerialize`"));
        expect(icon).toHaveProperty("markdown", expect.stringContaining("### `serialize`"));
        expect(reference.lookup("Gio.TlsConnection", "class")).toHaveProperty(
            "markdown", expect.stringContaining("getChannelBindingData(type: Gio.TlsChannelBindingType): boolean"),
        );
        expect(reference.lookup("Gio.DtlsConnection", "interface")).toHaveProperty(
            "markdown", expect.stringContaining("getChannelBindingData(type: Gio.TlsChannelBindingType): boolean"),
        );
    });
});
