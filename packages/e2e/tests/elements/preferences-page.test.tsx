import { AdwActionRow, AdwPreferencesGroup, AdwPreferencesPage } from "@gtkx/jsx/adw";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

function App({ showBehavior }: { showBehavior: boolean }) {
    return (
        <AdwPreferencesPage>
            <AdwPreferencesGroup title="Appearance">
                <AdwActionRow title="Dark Mode" />
            </AdwPreferencesGroup>
            {showBehavior && (
                <AdwPreferencesGroup title="Behavior">
                    <AdwActionRow title="Autosave" />
                </AdwPreferencesGroup>
            )}
        </AdwPreferencesPage>
    );
}

describe("render - PreferencesPage", () => {
    it("adds preference groups", async () => {
        await render(
            <AdwPreferencesPage>
                <AdwPreferencesGroup title="Appearance">
                    <AdwActionRow title="Dark Mode" />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title="Behavior">
                    <AdwActionRow title="Autosave" />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>,
        );

        expect(await screen.findByText("Appearance")).toBeDefined();
        expect(await screen.findByText("Dark Mode")).toBeDefined();
        expect(await screen.findByText("Autosave")).toBeDefined();
    });

    it("removes a preference group when unmounted", async () => {
        const { rerender } = await render(<App showBehavior={true} />);
        expect(await screen.findByText("Autosave")).toBeDefined();
        await rerender(<App showBehavior={false} />);
        expect(screen.queryByText("Autosave")).toBeNull();
        expect(await screen.findByText("Dark Mode")).toBeDefined();
    });
});
