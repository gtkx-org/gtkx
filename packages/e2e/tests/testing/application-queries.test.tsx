import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode, RefObject } from "react";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication, AdwApplicationWindow, AdwWindow } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { cleanup, getRoles, prettyWidget, render, screen, within } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

const nextApplicationId = createAppIdFactory("org.gtkx.applicationqueries");

type ApplicationWindowsProps = {
    appRef: RefObject<Adw.Application | null>;
    applicationId: string;
    hasOwnedWindows: boolean;
};

const ApplicationWindows = ({ appRef, applicationId, hasOwnedWindows }: ApplicationWindowsProps): ReactNode => (
    <>
        <AdwApplication ref={appRef} applicationId={applicationId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            {hasOwnedWindows && (
                <>
                    <AdwApplicationWindow title="Owned first">
                        <GtkButton name="owned-first" label="Shared action" />
                    </AdwApplicationWindow>
                    <AdwApplicationWindow title="Owned second">
                        <GtkButton name="owned-second" label="Shared action" />
                    </AdwApplicationWindow>
                </>
            )}
        </AdwApplication>
        <AdwWindow title="Foreign window">
            <GtkButton name="foreign-button" label="Shared action" />
        </AdwWindow>
    </>
);

describe("queries scoped to an application", () => {
    it("tracks owned windows, excludes foreign windows and handles an empty application", async () => {
        const appRef = createRef<Adw.Application>();
        const applicationId = nextApplicationId();
        const view = (hasOwnedWindows: boolean): ReactNode => (
            <ApplicationWindows appRef={appRef} applicationId={applicationId} hasOwnedWindows={hasOwnedWindows} />
        );

        try {
            const { rerender } = await render(view(true), { container: rootElement });
            const application = appRef.current;

            if (application === null) {
                throw new Error("The application did not mount");
            }

            expect(application.getWindows()).toHaveLength(2);
            const scope = within(application);
            expect(scope.getAllByRole(Gtk.AccessibleRole.BUTTON, { name: "Shared action" })).toHaveLength(2);
            expect(screen.getAllByRole(Gtk.AccessibleRole.BUTTON, { name: "Shared action" })).toHaveLength(3);
            const first = screen.getByName("owned-first");
            expect(scope.getByName("owned-first")).toBe(first);
            expect(getRoles(application).get("button")).toContain(first);
            expect(scope.queryByName("foreign-button")).toBeNull();
            expect(() => scope.getByName("foreign-button")).toThrow();
            expect(prettyWidget(application)).toContain("owned-first");
            expect(prettyWidget(application)).not.toContain("foreign-button");

            await rerender(view(false));
            expect(appRef.current).toBe(application);
            expect(application.getWindows()).toEqual([]);
            expect(scope.queryAllByRole(Gtk.AccessibleRole.WINDOW)).toEqual([]);
            expect(getRoles(application).size).toBe(0);
            expect(prettyWidget(application)).toBe("");
            expect(() => scope.getByName("owned-first")).toThrow();
            expect(screen.getByName("foreign-button")).toBeRooted();

            await rerender(view(true));
            expect(appRef.current).toBe(application);
            expect(scope.getAllByRole(Gtk.AccessibleRole.BUTTON, { name: "Shared action" })).toHaveLength(2);
            expect(scope.queryByName("foreign-button")).toBeNull();
        } finally {
            await cleanup();
        }
    });
});
