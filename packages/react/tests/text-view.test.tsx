import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { TextView } from "../src/index.js";
import { flushSync, render, setupTests } from "./utils.js";

setupTests();

// Track setText calls
let lastSetText: string | undefined;
let setTextCallCount = 0;
const originalSetText = Gtk.TextBuffer.prototype.setText;

beforeEach(() => {
    lastSetText = undefined;
    setTextCallCount = 0;

    Gtk.TextBuffer.prototype.setText = function (text: string, len: number) {
        lastSetText = text;
        setTextCallCount++;
        return originalSetText.call(this, text, len);
    };
});

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

    it("sets initial text from text prop", () => {
        lastSetText = undefined;

        const App = () => <TextView text="Hello World" />;

        render(<App />);

        expect(lastSetText).toBe("Hello World");
    });

    it("updates text when prop changes", () => {
        lastSetText = undefined;
        let setText: (value: string) => void = () => {};

        const App = () => {
            const [text, _setText] = useState("Initial");
            setText = _setText;
            return <TextView text={text} />;
        };

        render(<App />);
        expect(lastSetText).toBe("Initial");

        flushSync(() => setText("Updated"));
        expect(lastSetText).toBe("Updated");
    });

    it("does not update buffer when text prop matches current text", () => {
        lastSetText = undefined;
        let setText: (value: string) => void = () => {};

        const App = () => {
            const [text, _setText] = useState("Same");
            setText = _setText;
            return <TextView text={text} />;
        };

        render(<App />);

        // Reset counter after initial render
        const countBefore = setTextCallCount;

        flushSync(() => setText("Same"));
        expect(setTextCallCount).toBe(countBefore);
    });
});
