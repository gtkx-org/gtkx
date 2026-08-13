import type { AnyClass } from "@gtkx/utils";
import type { ReactNode } from "react";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkBox, GtkButton, GtkMenuButton } from "@gtkx/jsx/gtk";
import { getHandle, registerClass, wrapHandle } from "@gtkx/runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configure, getConfig, prettyRoles, prettyWidget, render, screen, userEvent } from "../src/index.js";
import { ancestors } from "../src/traversal.js";
import { getTypeTag } from "../src/widget-getters.js";
import { expectRejection } from "./widget-fixtures.js";

const ACTIONABILITY_TIMEOUT = 60;
const ANONYMOUS_TYPE_NAME = "GtkxAnonymousTagProbe";
const initialConfig = { ...getConfig() };
const AnonymousBox = registerClass(class extends Gtk.Box {}, { typeName: ANONYMOUS_TYPE_NAME });

const subclass = (base: typeof Gtk.Button) => class extends base {};
const wrapAs = <T extends object>(object: GObject.Object, cls: AnyClass<T>): T => wrapHandle(getHandle(object), cls);

const openMenu = async (labels: string[]): Promise<void> => {
    await render(
        <GtkMenuButton
            tooltipText="Main Menu"
            menuModel={<GMenu items={labels.map((label) => ({ label, action: "win.missing" }))} />}
        />,
    );

    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Main Menu" }));
};

const findMenuItem = (label: string): Promise<Gtk.Widget> =>
    screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: label });

const renderMenuItem = async (): Promise<Gtk.Widget> => {
    await openMenu(["New Task"]);

    return findMenuItem("New Task");
};

const findMenuPopover = (item: Gtk.Widget): Gtk.Widget => {
    for (const ancestor of ancestors(item)) {
        if (ancestor instanceof Gtk.Popover) {
            return ancestor;
        }
    }

    throw new Error("The menu item is not inside a popover");
};

const findButton = async (element: ReactNode, label: string): Promise<Gtk.Widget> => {
    await render(element);

    return screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label });
};

const findInsensitiveButton = (label: string): Promise<Gtk.Widget> =>
    findButton(<GtkButton label={label} sensitive={false} />, label);

const renderInsensitiveBox = async (): Promise<Gtk.Widget> => {
    await render(<GtkBox name="panel" sensitive={false} />);

    return screen.getByName<Gtk.Box>("panel");
};

const expectActionabilityFailure = async (widget: Gtk.Widget, description: string): Promise<void> => {
    await expect(userEvent.click(widget)).rejects.toThrow(
        `Cannot dispatch user event: ${description} did not become actionable`,
    );
};

class UnregisteredButton extends Gtk.Button {}

afterEach(() => {
    configure(initialConfig);
});

describe("getTypeTag", () => {
    it("names a type with no generated wrapper class by its GType", async () => {
        expect(getTypeTag(await renderMenuItem())).toBe("GtkModelButton");
    });

    it("names a type with a generated wrapper class by that class", async () => {
        expect(getTypeTag(await findButton(<GtkButton label="Tagged" />, "Tagged"))).toBe("Button");
    });

    it("names an instance wrapped as an ancestor class by its own type", async () => {
        const button = await findButton(<GtkButton label="Wrapped" />, "Wrapped");
        expect(getTypeTag(wrapAs(button, Gtk.Widget))).toBe("Button");
    });

    it("names a type whose registered wrapper class is anonymous by its GType", () => {
        expect(getTypeTag(new AnonymousBox())).toBe(ANONYMOUS_TYPE_NAME);
    });

    it("names an instance wrapped as a class carrying no GType by that class", async () => {
        const button = await findButton(<GtkButton label="Viewed" />, "Viewed");
        expect(getTypeTag(wrapAs(button, UnregisteredButton))).toBe("UnregisteredButton");
    });

    it("names an instance carrying no GType by its nearest named class", () => {
        const unwrapped = Object.create(subclass(Gtk.Button).prototype) as Gtk.Button;
        expect(getTypeTag(unwrapped)).toBe("Button");
    });

    it("names an object carrying neither a GType nor a class chain", () => {
        expect(getTypeTag(Object.create(null) as GObject.Object)).toBe("Object");
    });

    it("names an object whose own constructor is not a class", () => {
        const impostor = Object.create(null) as GObject.Object;
        Object.defineProperty(impostor, "constructor", { value: "GtkModelButton" });
        expect(getTypeTag(impostor)).toBe("Object");
    });
});

describe("prettyWidget on types with no generated wrapper class", () => {
    it("names every widget of the menu tree after its own GType", async () => {
        const dump = prettyWidget(findMenuPopover(await renderMenuItem()), { shouldHighlight: false });
        expect(dump).toContain("<GtkModelButton");
        expect(dump).toContain("</GtkModelButton>");
        expect(dump).toContain("<GtkPopoverContent");
        expect(dump).toContain("<GtkMenuSectionBox");
        expect(dump).not.toContain("< ");
        expect(dump).not.toContain("</>");
    });

    it("names a widget whose registered wrapper class is anonymous by its GType", () => {
        const dump = prettyWidget(new AnonymousBox(), { shouldHighlight: false });
        expect(dump).toContain(`<${ANONYMOUS_TYPE_NAME}`);
        expect(dump).not.toContain("< ");
    });
});

describe("prettyWidget on instances wrapped as a class carrying no GType", () => {
    it("names the widget after the class it was wrapped as", async () => {
        const button = await findButton(<GtkButton label="Wrapped" />, "Wrapped");
        const dump = prettyWidget(wrapAs(button, UnregisteredButton), { shouldHighlight: false });
        expect(dump).toContain("<UnregisteredButton");
        expect(dump).toContain("</UnregisteredButton>");
    });
});

describe("prettyRoles on types with no generated wrapper class", () => {
    it("names every widget next to its role", async () => {
        const output = prettyRoles(findMenuPopover(await renderMenuItem()));
        expect(output).toContain('<GtkModelButton role="menu_item">');
        expect(output).toContain('<GtkPopoverContent role="generic">');
    });
});

describe("userEvent errors", () => {
    beforeEach(() => {
        configure({ actionabilityTimeout: ACTIONABILITY_TIMEOUT });
    });

    it("names a widget whose type has no generated wrapper class", async () => {
        const item = await renderMenuItem();
        await expectActionabilityFailure(item, '<GtkModelButton accessible-name="New Task" role="menu_item">');
    });

    it("tells two items of the same menu apart by their accessible names", async () => {
        await openMenu(["New Task", "Delete Task"]);

        await expectActionabilityFailure(
            await findMenuItem("New Task"),
            '<GtkModelButton accessible-name="New Task" role="menu_item">',
        );

        await expectActionabilityFailure(
            await findMenuItem("Delete Task"),
            '<GtkModelButton accessible-name="Delete Task" role="menu_item">',
        );
    });

    it("names a widget wrapped as an ancestor class by its own type", async () => {
        const button = await findInsensitiveButton("Save");
        await expectActionabilityFailure(wrapAs(button, Gtk.Widget), '<Button accessible-name="Save" role="button">');
    });

    it("omits the name attribute when the widget carries GTK's default name", async () => {
        const button = await findInsensitiveButton("Save");
        await expectActionabilityFailure(button, '<Button accessible-name="Save" role="button">');
    });

    it("keeps a custom name that ends with the type tag", async () => {
        const button = await findButton(<GtkButton name="MyButton" label="Custom" sensitive={false} />, "Custom");
        await expectActionabilityFailure(button, '<Button accessible-name="Custom" name="MyButton" role="button">');
    });

    it("omits the accessible name when the widget has none", async () => {
        const box = await renderInsensitiveBox();
        await expectActionabilityFailure(box, '<Box name="panel" role="generic">');
    });

    it("names the widget slide rejects by its own type", async () => {
        const button = await findButton(<GtkButton label="Slide" />, "Slide");

        await expect(userEvent.slide(wrapAs(button, Gtk.Widget), 5)).rejects.toThrow(
            "userEvent.slide requires a Gtk.Range (e.g. Gtk.Scale), got Button",
        );
    });
});

describe("object matchers", () => {
    it("name a non-widget object wrapped as an ancestor class by its own type", () => {
        const adjustment = wrapAs(new Gtk.Adjustment({ lower: 0, upper: 5 }), GObject.Object);

        expectRejection(() => {
            expect(adjustment).toHaveObjectProperty("not-a-property", 1);
        }, /no readable property "not-a-property" on <Adjustment>/);
    });
});
