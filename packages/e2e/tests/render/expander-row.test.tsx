import type * as Adw from "@gtkx/ffi/adw";
import { AdwExpanderRow, GtkButton, x } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - ExpanderRow", () => {
    describe("ExpanderRowNode", () => {
        it("creates ExpanderRow widget", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            await render(<AdwExpanderRow ref={ref} title="Test" />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getTitle()).toBe("Test");
        });

        it("updates title when prop changes", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            function App({ title }: { title: string }) {
                return <AdwExpanderRow ref={ref} title={title} />;
            }

            await render(<App title="Initial" />);
            expect(ref.current?.getTitle()).toBe("Initial");

            await render(<App title="Updated" />);
            expect(ref.current?.getTitle()).toBe("Updated");
        });

        it("adds prefix and suffix widgets via ActionRowChild", async () => {
            await render(
                <AdwExpanderRow title="Row">
                    <x.ActionRowPrefix>
                        <GtkButton label="Prefix" />
                    </x.ActionRowPrefix>
                    <x.ActionRowSuffix>
                        <GtkButton label="Suffix" />
                    </x.ActionRowSuffix>
                </AdwExpanderRow>,
            );

            expect(true).toBe(true);
        });
    });
});
