import * as Gio from "@gtkx/gi/gio";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createCollectionModel } from "../src/internal/collection-model.js";

class DecoyLevelStore extends Gio.ListStore {}

describe("createCollectionModel", () => {
    it("keeps reporting the registration failure once the level store name is taken", () => {
        registerClass(DecoyLevelStore, { typeName: "GtkxLazyLevelStore" });
        expect(() => createCollectionModel()).toThrow(/already registered/);
        expect(() => createCollectionModel()).toThrow(/already registered/);
    });
});
