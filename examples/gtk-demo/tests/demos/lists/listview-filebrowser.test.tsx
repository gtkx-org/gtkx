import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewFilebrowserDemo } from "../../../src/demos/lists/listview-filebrowser.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAll, findApplicationWindow, findFirst } from "./helpers.js";

describe("listviewFilebrowserDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listviewFilebrowserDemo, { id: "listview-filebrowser", title: "Lists/File browser" });
        expect(typeof listviewFilebrowserDemo.sourceCode).toBe("string");
        expect(listviewFilebrowserDemo.keywords).toContain("listview");
        expect(listviewFilebrowserDemo.keywords).toContain("gridview");
        expect(listviewFilebrowserDemo.defaultWidth).toBe(600);
        expect(listviewFilebrowserDemo.defaultHeight).toBe(400);
        expect(listviewFilebrowserDemo.component).toBeTypeOf("function");
    });

    it("installs a header bar via the titlebar slot", async () => {
        const { container } = await renderDemo(listviewFilebrowserDemo);
        const window = findApplicationWindow(container);
        expect(window).toBeInstanceOf(Gtk.ApplicationWindow);
        expect(window?.getTitlebar()).toBeInstanceOf(Gtk.HeaderBar);
    });

    it("renders a go-up button in the header bar", async () => {
        const { container } = await renderDemo(listviewFilebrowserDemo);
        const window = findApplicationWindow(container);
        if (!window) throw new Error("window not found");
        const buttons = findAll(window, Gtk.Button);
        const upButton = buttons.find((b) => b.getIconName() === "go-up-symbolic");
        expect(upButton).toBeInstanceOf(Gtk.Button);
    });

    it("renders a view-mode list view with three entries", async () => {
        const { container } = await renderDemo(listviewFilebrowserDemo);
        const window = findApplicationWindow(container);
        if (!window) throw new Error("window not found");
        const lists = findAll(window, Gtk.ListView);
        expect(lists.length).toBeGreaterThanOrEqual(1);
        const switcher = lists[0];
        if (!switcher) throw new Error("view switcher missing");
        const model = switcher.getModel();
        expect(model?.getNItems()).toBe(3);
    });

    it("renders the file grid view inside a scrolled window", async () => {
        const { container } = await renderDemo(listviewFilebrowserDemo);
        const grid = findFirst(container, Gtk.GridView);
        expect(grid).toBeInstanceOf(Gtk.GridView);
        let parent: Gtk.Widget | null = grid;
        let sw: Gtk.ScrolledWindow | null = null;
        while (parent) {
            if (parent instanceof Gtk.ScrolledWindow) {
                sw = parent;
                break;
            }
            parent = parent.getParent();
        }
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
    });
});
