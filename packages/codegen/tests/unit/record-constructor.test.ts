import { describe, expect, it } from "vitest";
import { constructionGuard } from "../helpers/construction-guard.js";
import { fixtureModules } from "../helpers/fixture-modules.js";

const opaque = String(fixtureModules(["Opaque-1.0"]).get("Opaque"));

const guardFor = (className: string): string => constructionGuard(opaque, `Opaque.${className}`);

describe("a record no caller can construct", () => {
    it.each(["KeyFile", "Bytes", "AsyncQueue", "Language", "MatchInfo", "Query"])(
        "declares %s abstract, so new is rejected before it runs",
        (className) => {
            expect(opaque).toContain(`export abstract class ${className} {`);
        },
    );

    it.each(["KeyFile", "Bytes", "AsyncQueue", "Language", "MatchInfo", "Query"])(
        "declares no constructor props for %s, whose constructor takes none",
        (className) => {
            expect(opaque).not.toContain(`${className}ConstructorProps`);
        },
    );

    it("names the constructor the GIR declares", () => {
        expect(guardFor("KeyFile")).toBe("use Opaque.KeyFile.new() instead.");
    });

    it("names the arguments that constructor takes, folding away the array length", () => {
        expect(guardFor("Bytes")).toBe("use Opaque.Bytes.new(data) instead.");
    });

    it("names a plain function that returns the record, preferring the one spelled new", () => {
        expect(opaque).toContain("static lookup(name: string): AsyncQueue");
        expect(guardFor("AsyncQueue")).toBe("use Opaque.AsyncQueue.new() instead.");
    });

    it("names the lookup function when no static is spelled new", () => {
        expect(guardFor("Language")).toBe("use Opaque.Language.fromString(language) instead.");
    });

    it("points at the functions returning the record when no static returns one", () => {
        expect(opaque).toContain("static describe(): string");
        expect(guardFor("MatchInfo")).toBe("its instances come from the functions that return them.");
        expect(guardFor("Query")).toBe("its instances come from the functions that return them.");
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

describe("a caller-allocated out-parameter", () => {
    it("constructs the record when its class offers a constructor", () => {
        expect(opaque).toContain("return opaqueBounds(new Rect())");
    });

    it("allocates a buffer of the computed size when the class is abstract", () => {
        expect(opaque).toContain("export function query(id: number): Query");
        expect(opaque).toContain("return opaqueQuery(id, wrapHandle(alloc(16), Query))");
    });

    it("drops the callable when the record has no computed layout to allocate", () => {
        expect(opaque).not.toContain("opaque_collect\"");
        expect(opaque).not.toContain("export function collect(");
    });

    it("passes undefined and drops the out-parameter when the record is optional", () => {
        expect(opaque).toContain("export function collectOptional(): boolean");
        expect(opaque).toContain("return opaqueCollectOptional(undefined)");
    });
});
