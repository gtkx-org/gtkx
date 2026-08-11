import { describe, expect, it } from "vitest";
import { ModuleBuilder } from "../../src/writer/module.js";

const LIST_MODEL_IMPL = "export interface ListModelImpl {}";

describe("ModuleBuilder", () => {
    it("takes the several declarations one symbol merges under its own name", () => {
        const builder = new ModuleBuilder();

        builder.appendDeclaration({
            name: "ListModel",
            code: "export interface ListModel {}",
            owner: "Gio.ListModel",
        });

        builder.appendDeclaration({
            name: "ListModel",
            code: "export abstract class ListModel {}",
            owner: "Gio.ListModel",
        });

        expect(builder.toSource()).toBe(
            "export interface ListModel {}\n\nexport abstract class ListModel {}\n",
        );
    });

    it("rejects one type name claimed by two owners", () => {
        const builder = new ModuleBuilder();
        builder.appendDeclaration({ name: "ListModelImpl", code: LIST_MODEL_IMPL, owner: "Gio.ListModel" });

        const declareAgain = (): void => {
            builder.appendDeclaration({ name: "ListModelImpl", code: LIST_MODEL_IMPL, owner: "Gtk.SelectionModel" });
        };

        expect(declareAgain).toThrow(
            "The generated type 'ListModelImpl' is declared for both Gio.ListModel and Gtk.SelectionModel.",
        );
    });

    it("rejects a registration naming a symbol the module never declares", () => {
        const builder = new ModuleBuilder();
        builder.appendRegistration("init();", ["init"]);

        expect(() => builder.toSource()).toThrow(
            "The generated module registers init, which it never declares.",
        );
    });

    it("accepts a registration once the declaration it names is emitted", () => {
        const builder = new ModuleBuilder();
        builder.appendRegistration("init();", ["init"]);
        builder.appendDeclaration({ name: "init", code: "export function init(): void {}" });
        expect(builder.toSource()).toBe("export function init(): void {}\n\ninit();\n");
    });
});
