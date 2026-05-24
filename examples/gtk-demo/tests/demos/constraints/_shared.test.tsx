import * as Gtk from "@gtkx/ffi/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { ThreeButtonsBox } from "../../../src/demos/constraints/_shared.js";

interface RefBundle {
    containerRef: RefObject<Gtk.Box | null>;
    button1Ref: RefObject<Gtk.Button | null>;
    button2Ref: RefObject<Gtk.Button | null>;
    button3Ref: RefObject<Gtk.Button | null>;
}

const makeRefs = (): RefBundle => ({
    containerRef: createRef<Gtk.Box | null>(),
    button1Ref: createRef<Gtk.Button | null>(),
    button2Ref: createRef<Gtk.Button | null>(),
    button3Ref: createRef<Gtk.Button | null>(),
});

const renderThreeButtons = async (): Promise<RefBundle> => {
    const refs = makeRefs();
    await render(<ThreeButtonsBox {...refs} namedButtons />);
    return refs;
};

describe("ThreeButtonsBox structure", () => {
    it("renders a GtkBox containing three labelled buttons", async () => {
        await renderThreeButtons();
        const box = await screen.findByName("container");
        expect(box).toBeInstanceOf(Gtk.Box);
        const button1 = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 1" });
        const button2 = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 2" });
        const button3 = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 3" });
        expect(button1).toBeInstanceOf(Gtk.Button);
        expect(button2).toBeInstanceOf(Gtk.Button);
        expect(button3).toBeInstanceOf(Gtk.Button);
        expect((button1 as Gtk.Button).getLabel()).toBe("Child 1");
        expect((button2 as Gtk.Button).getLabel()).toBe("Child 2");
        expect((button3 as Gtk.Button).getLabel()).toBe("Child 3");
    });
});

describe("ThreeButtonsBox layout", () => {
    it("expands horizontally and vertically", async () => {
        await renderThreeButtons();
        const box = (await screen.findByName("container")) as Gtk.Box;
        expect(box.getHexpand()).toBe(true);
        expect(box.getVexpand()).toBe(true);
    });

    it("renders the three buttons named button1/button2/button3", async () => {
        await renderThreeButtons();
        const button1 = (await screen.findByName("button1")) as Gtk.Button;
        const button2 = (await screen.findByName("button2")) as Gtk.Button;
        const button3 = (await screen.findByName("button3")) as Gtk.Button;
        expect(button1.getLabel()).toBe("Child 1");
        expect(button2.getLabel()).toBe("Child 2");
        expect(button3.getLabel()).toBe("Child 3");
    });
});
