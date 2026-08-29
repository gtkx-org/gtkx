import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import { rootElement } from "@gtkx/react";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { useStore } from "../src/store/index.js";

describe("Tasks in French", () => {
    it("renders translated controls and starter content", async () => {
        await render(<App />, { container: rootElement });

        expect(
            await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Nouvelle tâche (Ctrl+N)" }),
        ).toBeDefined();

        expect(
            await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Arroser les plantes/ }),
        ).toBeDefined();
    });

    it("uses French interpolation and plural forms", async () => {
        const due = new Date();
        due.setDate(due.getDate() - 2);
        const tasks = useStore.getState().tasks.map((task) =>
            task.id === "t2" ? { ...task, due: due.toISOString() } : task,
        );
        useStore.setState({ tasks });

        await render(<App />, { container: rootElement });

        expect(await screen.findByText("Il y a 2 jours")).toHaveTextContent("Il y a 2 jours");

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Rechercher (Ctrl+F)" }));
        const search = await screen.findByPlaceholderText("Rechercher des tâches…");
        await userEvent.type(search, "introuvable");

        expect(await screen.findByText("Aucune tâche ne correspond à « introuvable »")).toHaveTextContent(
            "Aucune tâche ne correspond à « introuvable »",
        );
    });

    it("rejects a plural count gettext cannot represent", () => {
        expect(() =>
            t("{{count}} day ago", {
                count: 1.5,
                defaultValue_one: "{{count}} day ago",
                defaultValue_other: "{{count}} days ago",
            }),
        ).toThrow();
    });
});
