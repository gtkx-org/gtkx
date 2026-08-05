import { describe, expect, it } from "vitest";
import { ModuleBuilder } from "../../src/writer/module.js";

const LIST_MODEL_IMPL = "export interface ListModelImpl {}";

describe("ModuleBuilder", () => {
    it("takes the several declarations one symbol merges under its own name", () => {
        const builder = new ModuleBuilder();
        builder.appendDeclaration("export interface ListModel {}", { name: "ListModel", owner: "Gio.ListModel" });
        builder.appendDeclaration("export abstract class ListModel {}", { name: "ListModel", owner: "Gio.ListModel" });

        expect(builder.toSource()).toBe(
            "export interface ListModel {}\n\nexport abstract class ListModel {}\n",
        );
    });

    it("leaves an unclaimed declaration out of the registry", () => {
        const builder = new ModuleBuilder();
        builder.appendDeclaration(LIST_MODEL_IMPL);

        const declareAgain = (): void => {
            builder.appendDeclaration(LIST_MODEL_IMPL, { name: "ListModelImpl", owner: "Gio.ListModel" });
        };

        expect(declareAgain).not.toThrow();
    });
});
