import * as Gtk from "@gtkx/ffi/gtk";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { ThreeButtonsBox } from "../../../src/demos/constraints/_shared.js";
import { render } from "../../test-utils.js";

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
    await render(<ThreeButtonsBox {...refs} />);
    return refs;
};

describe("ThreeButtonsBox structure", () => {
    it("renders a GtkBox containing three labelled buttons", async () => {
        const refs = await renderThreeButtons();
        expect(refs.containerRef.current).toBeInstanceOf(Gtk.Box);
        expect(refs.button1Ref.current).toBeInstanceOf(Gtk.Button);
        expect(refs.button2Ref.current).toBeInstanceOf(Gtk.Button);
        expect(refs.button3Ref.current).toBeInstanceOf(Gtk.Button);
        expect(refs.button1Ref.current?.getLabel()).toBe("Child 1");
        expect(refs.button2Ref.current?.getLabel()).toBe("Child 2");
        expect(refs.button3Ref.current?.getLabel()).toBe("Child 3");
    });
});

describe("ThreeButtonsBox layout", () => {
    it("expands horizontally and vertically", async () => {
        const refs = await renderThreeButtons();
        const box = refs.containerRef.current;
        expect(box?.getHexpand()).toBe(true);
        expect(box?.getVexpand()).toBe(true);
    });

    it("renders the three buttons as direct children of the box in order", async () => {
        const refs = await renderThreeButtons();
        const box = refs.containerRef.current;
        if (!box) throw new Error("box ref missing");

        const children: Gtk.Widget[] = [];
        let child = box.getFirstChild();
        while (child) {
            children.push(child);
            child = child.getNextSibling();
        }

        expect(children).toHaveLength(3);
        expect((children[0] as Gtk.Button).getLabel()).toBe("Child 1");
        expect((children[1] as Gtk.Button).getLabel()).toBe("Child 2");
        expect((children[2] as Gtk.Button).getLabel()).toBe("Child 3");
    });
});
