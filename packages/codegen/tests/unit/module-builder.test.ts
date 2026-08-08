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

    it("rejects one type name claimed by two owners", () => {
        const builder = new ModuleBuilder();
        builder.appendDeclaration(LIST_MODEL_IMPL, { name: "ListModelImpl", owner: "Gio.ListModel" });

        const declareAgain = (): void => {
            builder.appendDeclaration(LIST_MODEL_IMPL, { name: "ListModelImpl", owner: "Gtk.SelectionModel" });
        };

        expect(declareAgain).toThrow(
            "The generated type 'ListModelImpl' is declared for both Gio.ListModel and Gtk.SelectionModel.",
        );
    });
});
