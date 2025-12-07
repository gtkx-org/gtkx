import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { TextView } from "../src/index.js";
import { render, setupTests } from "./utils.js";

setupTests();

describe("TextView widget", () => {
    it("renders a TextView", () => {
        let textViewRef: Gtk.TextView | undefined;

        const App = () => (
            <TextView
                ref={(ref: Gtk.TextView | null) => {
                    textViewRef = ref ?? undefined;
                }}
            />
        );

        render(<App />);

        expect(textViewRef).toBeDefined();
    });

    it("applies editable property", () => {
        let textViewRef: Gtk.TextView | undefined;

        const App = () => (
            <TextView
                editable={false}
                ref={(ref: Gtk.TextView | null) => {
                    textViewRef = ref ?? undefined;
                }}
            />
        );

        render(<App />);

        expect(textViewRef?.getEditable()).toBe(false);
    });

    it("applies cursorVisible property", () => {
        let textViewRef: Gtk.TextView | undefined;

        const App = () => (
            <TextView
                cursorVisible={false}
                ref={(ref: Gtk.TextView | null) => {
                    textViewRef = ref ?? undefined;
                }}
            />
        );

        render(<App />);

        expect(textViewRef?.getCursorVisible()).toBe(false);
    });

    it("applies monospace property", () => {
        let textViewRef: Gtk.TextView | undefined;

        const App = () => (
            <TextView
                monospace={true}
                ref={(ref: Gtk.TextView | null) => {
                    textViewRef = ref ?? undefined;
                }}
            />
        );

        render(<App />);

        expect(textViewRef?.getMonospace()).toBe(true);
    });

    it("applies wrapMode property", () => {
        let textViewRef: Gtk.TextView | undefined;

        const App = () => (
            <TextView
                wrapMode={Gtk.WrapMode.WORD}
                ref={(ref: Gtk.TextView | null) => {
                    textViewRef = ref ?? undefined;
                }}
            />
        );

        render(<App />);

        expect(textViewRef?.getWrapMode()).toBe(Gtk.WrapMode.WORD);
    });
});
