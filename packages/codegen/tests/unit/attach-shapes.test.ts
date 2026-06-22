import { describe, expect, it } from "vitest";
import { collectAttachShapes } from "../../src/react/attach-shapes.js";
import { repository } from "../helpers/repository.js";

const shapes = collectAttachShapes(repository);

describe("attach-shape verification over Gtk and Adw", () => {
    it("records multi-child boxes with the verified container methods", () => {
        expect(shapes["GtkBox"]).toEqual(["append", "remove", "reorderChildAfter", "insertChildAfter"]);
        expect(shapes["GtkListBox"]).toEqual(expect.arrayContaining(["append", "remove", "insert"]));
        expect(shapes["GtkFlowBox"]).toEqual(expect.arrayContaining(["append", "remove", "insert"]));
    });

    it("records single-child containers under setChild and getChild", () => {
        expect(shapes["GtkFrame"]).toEqual(["setChild", "getChild"]);
        expect(shapes["GtkScrolledWindow"]).toEqual(["setChild", "getChild"]);
        expect(shapes["GtkListItem"]).toEqual(["setChild", "getChild"]);
    });

    it("anchors getFirstChild on GtkWidget so every widget inherits it", () => {
        expect(shapes["GtkWidget"]).toEqual(["getFirstChild"]);
    });

    it("rejects same-named methods whose signature is not the widget-container shape", () => {
        // GtkComboBoxText.append(id, text) / insert(position, id, text) / remove(position)
        expect(shapes["GtkComboBoxText"]).toBeUndefined();
        // AdwMultiLayoutView.set_child(id, child) / get_child(id) take an id, not a bare child
        expect(shapes["AdwMultiLayoutView"]).toBeUndefined();
        // AdwToggleGroup.add(AdwToggle) and AdwSidebar.append(AdwSidebarSection) take non-widgets
        expect(shapes["AdwToggleGroup"]).toBeUndefined();
        expect(shapes["AdwSidebar"]).toBeUndefined();
    });

    it("keeps a nullable single-child setter such as GtkColumnViewCell.set_child", () => {
        expect(shapes["GtkColumnViewCell"]).toEqual(expect.arrayContaining(["setChild", "getChild"]));
    });
});
