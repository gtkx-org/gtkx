import type * as Adw from "@gtkx/gi/adw";
import { AdwActionRow, AdwPreferencesGroup, AdwPreferencesPage } from "@gtkx/jsx/adw";
import { getWidgetText, render, screen } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const renderRow = async (title: string, isUnderlineUsed: boolean): Promise<RefObject<Adw.ActionRow | null>> => {
    const ref = createRef<Adw.ActionRow>();

    await render(
        <AdwPreferencesPage>
            <AdwPreferencesGroup title="Server">
                <AdwActionRow ref={ref} title={title} useUnderline={isUnderlineUsed} />
            </AdwPreferencesGroup>
        </AdwPreferencesPage>,
    );

    return ref;
};

describe("render - access keys", () => {
    it("drops the mnemonic marker from a preferences row title", async () => {
        await renderRow("_Host", true);
        expect(await screen.findByText("Host")).toBeDefined();
    });

    it("keeps an underscore in a title that does not use an underline", async () => {
        await renderRow("_Host", false);
        expect(await screen.findByText("_Host")).toBeDefined();
    });

    it("reports the drawn title as the row's node text", async () => {
        const ref = await renderRow("_Database File", true);
        const row = ref.current;
        expect(row).not.toBeNull();
        expect(row === null ? null : getWidgetText(row)).toBe("Database File");
    });
});
