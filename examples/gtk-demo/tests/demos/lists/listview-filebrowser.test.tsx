import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewFilebrowserDemo } from "../../../src/demos/lists/listview-filebrowser.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { ancestorOfType, findApplicationWindow } from "../../helpers/traverse.js";

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
        await renderDemo(listviewFilebrowserDemo);
        const upButton = (await screen.findByName("up-button")) as Gtk.Button;
        expect(upButton).toBeInstanceOf(Gtk.Button);
        expect(upButton.getIconName()).toBe("go-up-symbolic");
    });

    it("renders a view-mode list view with three entries", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const switcher = (await screen.findByName("view-switcher")) as Gtk.ListView;
        const model = switcher.getModel();
        expect(model?.getNItems()).toBe(3);
    });

    it("renders the file grid view inside a scrolled window", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        expect(grid).toBeInstanceOf(Gtk.GridView);
        const sw = ancestorOfType(grid, Gtk.ScrolledWindow);
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
    });
});
