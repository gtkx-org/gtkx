import { describe, expect, it } from "vitest";
import { fixtureModules } from "../helpers/fixture-modules.js";

const opaque = String(fixtureModules(["Opaque-1.0"]).get("Opaque"));

describe("a record whose layout the GIR hides", () => {
    it("declares the class abstract, so new is rejected before it runs", () => {
        expect(opaque).toContain("export abstract class KeyFile {");
        expect(opaque).toContain("export abstract class MatchInfo {");
    });

    it("names the record's own constructor in the guard an untyped caller trips", () => {
        expect(opaque).toContain(
            "throw new globalThis.Error(\"Cannot construct Opaque.KeyFile with new: " +
            "use Opaque.KeyFile.new() instead.\");",
        );
    });

    it("points at the functions returning the record when the GIR declares no constructor", () => {
        expect(opaque).toContain(
            "throw new globalThis.Error(\"Cannot construct Opaque.MatchInfo with new: " +
            "its instances come from the functions that return them.\");",
        );
    });

    it("declares no constructor props for a constructor taking none", () => {
        expect(opaque).not.toContain("KeyFileConstructorProps");
        expect(opaque).not.toContain("MatchInfoConstructorProps");
    });
});

describe("a record whose layout the GIR declares", () => {
    it("keeps the class constructible from its fields", () => {
        expect(opaque).toContain("export class Rect {");
        expect(opaque).toContain("constructor(props: RectConstructorProps = {})");
    });

    it("declares the props that constructor takes", () => {
        expect(opaque).toContain("export interface RectConstructorProps {");
    });
});
