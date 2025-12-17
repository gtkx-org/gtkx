import { describe, expect, it } from "vitest";
import * as Gtk from "../src/generated/gtk/index.js";
import { getObject, registerType } from "../src/index.js";

describe("registerType", () => {
    it("registers a class with glibTypeName", () => {
        class TestClass {
            static glibTypeName = "TestType";
            id: unknown;
        }
        registerType(TestClass);
    });

    it("allows getObject to find registered types", () => {
        const label = new Gtk.Label("Test");
        const wrapped = getObject(label.id);
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });
});
