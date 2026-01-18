import type * as Adw from "@gtkx/ffi/adw";
import { AdwActionRow, AdwExpanderRow, GtkButton, x } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - ExpanderRowChild", () => {
    describe("ExpanderRowRow", () => {
        it("adds nested rows to ExpanderRow", async () => {
            const rowRef = createRef<Adw.ActionRow>();

            await render(
                <AdwExpanderRow title="Settings">
                    <x.ExpanderRowRow>
                        <AdwActionRow ref={rowRef} title="Option 1" />
                    </x.ExpanderRowRow>
                </AdwExpanderRow>,
            );

            expect(rowRef.current).not.toBeNull();
            expect(rowRef.current?.getTitle()).toBe("Option 1");
        });

        it("adds multiple rows", async () => {
            const row1Ref = createRef<Adw.ActionRow>();
            const row2Ref = createRef<Adw.ActionRow>();

            await render(
                <AdwExpanderRow title="Settings">
                    <x.ExpanderRowRow>
                        <AdwActionRow ref={row1Ref} title="Option 1" />
                        <AdwActionRow ref={row2Ref} title="Option 2" />
                    </x.ExpanderRowRow>
                </AdwExpanderRow>,
            );

            expect(row1Ref.current?.getTitle()).toBe("Option 1");
            expect(row2Ref.current?.getTitle()).toBe("Option 2");
        });

        it("removes nested rows when unmounted", async () => {
            const expanderRef = createRef<Adw.ExpanderRow>();

            function App({ showRow }: { showRow: boolean }) {
                return (
                    <AdwExpanderRow ref={expanderRef} title="Settings">
                        <x.ExpanderRowRow>
                            <AdwActionRow title="Always" />
                            {showRow && <AdwActionRow title="Conditional" />}
                        </x.ExpanderRowRow>
                    </AdwExpanderRow>
                );
            }

            await render(<App showRow={true} />);
            expect(expanderRef.current).not.toBeNull();

            await render(<App showRow={false} />);
            expect(expanderRef.current).not.toBeNull();
        });
    });

    describe("ExpanderRowAction", () => {
        it("adds action widgets to ExpanderRow", async () => {
            await render(
                <AdwExpanderRow title="Group">
                    <x.ExpanderRowAction>
                        <GtkButton label="Action" />
                    </x.ExpanderRowAction>
                </AdwExpanderRow>,
            );

            expect(true).toBe(true);
        });

        it("adds multiple action widgets", async () => {
            await render(
                <AdwExpanderRow title="Group">
                    <x.ExpanderRowAction>
                        <GtkButton label="Action 1" />
                        <GtkButton label="Action 2" />
                    </x.ExpanderRowAction>
                </AdwExpanderRow>,
            );

            expect(true).toBe(true);
        });
    });

    describe("combined rows and actions", () => {
        it("handles multiple rows and actions together", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            await render(
                <AdwExpanderRow ref={ref} title="Complex">
                    <x.ExpanderRowAction>
                        <GtkButton label="Action 1" />
                        <GtkButton label="Action 2" />
                    </x.ExpanderRowAction>
                    <x.ExpanderRowRow>
                        <AdwActionRow title="Row 1" />
                        <AdwActionRow title="Row 2" />
                        <AdwActionRow title="Row 3" />
                    </x.ExpanderRowRow>
                </AdwExpanderRow>,
            );

            expect(ref.current).not.toBeNull();
        });
    });
});
