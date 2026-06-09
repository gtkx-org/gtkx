import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox } from "@gtkx/react-gi/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("construct-only properties", () => {
    it("sets cssName during widget construction", async () => {
        const ref = createRef<Gtk.Box>();

        await render(<GtkBox ref={ref} cssName="my-custom-widget" />);

        expect(ref.current).not.toBeNull();
        expect(ref.current?.getCssName()).toBe("my-custom-widget");
    });

    it("does not update cssName on re-render", async () => {
        const ref = createRef<Gtk.Box>();

        function App({ name }: { name: string }) {
            return <GtkBox ref={ref} cssName={name} />;
        }

        const { rerender } = await render(<App name="initial-name" />);
        expect(ref.current?.getCssName()).toBe("initial-name");

        await rerender(<App name="changed-name" />);
        expect(ref.current?.getCssName()).toBe("initial-name");
    });

    it("creates widget without construct-only prop set", async () => {
        const ref = createRef<Gtk.Box>();

        await render(<GtkBox ref={ref} />);

        expect(ref.current).not.toBeNull();
        expect(ref.current?.getCssName()).toBeTruthy();
    });
});
