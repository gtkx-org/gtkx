import * as Adw from "@gtkx/ffi/adw";
import { AdwAlertDialog } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

const options = { wrapper: false } as const;

type Response = { id: string; label: string };

const buildAlertDialog = (ref: RefObject<Adw.AlertDialog | null>) => (responses: Response[]) => (
    <AdwAlertDialog ref={ref} heading="Test" responses={responses} />
);

describe("render - AlertDialogResponse > AlertDialogNode (1)", () => {
    it("creates AlertDialog without responses", async () => {
        const ref = createRef<Adw.AlertDialog>();

        await render(<AdwAlertDialog ref={ref} heading="Test" />, options);

        expect(ref.current).not.toBeNull();
        expect(ref.current?.hasResponse("any")).toBe(false);
    });

    it("creates AlertDialog with responses", async () => {
        const ref = createRef<Adw.AlertDialog>();

        await render(
            <AdwAlertDialog
                ref={ref}
                heading="Test"
                responses={[
                    { id: "cancel", label: "Cancel" },
                    { id: "confirm", label: "Confirm" },
                ]}
            />,
            options,
        );

        expect(ref.current?.hasResponse("cancel")).toBe(true);
        expect(ref.current?.hasResponse("confirm")).toBe(true);
    });

    it("sets response label", async () => {
        const ref = createRef<Adw.AlertDialog>();

        await render(
            <AdwAlertDialog ref={ref} heading="Test" responses={[{ id: "ok", label: "OK Button" }]} />,
            options,
        );

        expect(ref.current?.getResponseLabel("ok")).toBe("OK Button");
    });
});

describe("render - AlertDialogResponse > AlertDialogNode (2)", () => {
    it("sets response appearance", async () => {
        const ref = createRef<Adw.AlertDialog>();

        await render(
            <AdwAlertDialog
                ref={ref}
                heading="Test"
                responses={[
                    { id: "default", label: "Default" },
                    { id: "suggested", label: "Suggested", appearance: Adw.ResponseAppearance.SUGGESTED },
                    { id: "destructive", label: "Delete", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
                ]}
            />,
            options,
        );

        expect(ref.current?.getResponseAppearance("default")).toBe(Adw.ResponseAppearance.DEFAULT);
        expect(ref.current?.getResponseAppearance("suggested")).toBe(Adw.ResponseAppearance.SUGGESTED);
        expect(ref.current?.getResponseAppearance("destructive")).toBe(Adw.ResponseAppearance.DESTRUCTIVE);
    });

    it("sets response enabled state", async () => {
        const ref = createRef<Adw.AlertDialog>();

        await render(
            <AdwAlertDialog
                ref={ref}
                heading="Test"
                responses={[
                    { id: "enabled", label: "Enabled" },
                    { id: "disabled", label: "Disabled", enabled: false },
                ]}
            />,
            options,
        );

        expect(ref.current?.getResponseEnabled("enabled")).toBe(true);
        expect(ref.current?.getResponseEnabled("disabled")).toBe(false);
    });
});

describe("render - AlertDialogResponse > AlertDialogNode (3)", () => {
    it("updates response label", async () => {
        const ref = createRef<Adw.AlertDialog>();

        function App({ label }: { label: string }) {
            return <AdwAlertDialog ref={ref} heading="Test" responses={[{ id: "test", label }]} />;
        }

        await render(<App label="Initial" />, options);
        expect(ref.current?.getResponseLabel("test")).toBe("Initial");

        await render(<App label="Updated" />, options);
        expect(ref.current?.getResponseLabel("test")).toBe("Updated");
    });

    it("updates response appearance", async () => {
        const ref = createRef<Adw.AlertDialog>();

        function App({ appearance }: { appearance: Adw.ResponseAppearance }) {
            return <AdwAlertDialog ref={ref} heading="Test" responses={[{ id: "test", label: "Test", appearance }]} />;
        }

        await render(<App appearance={Adw.ResponseAppearance.DEFAULT} />, options);
        expect(ref.current?.getResponseAppearance("test")).toBe(Adw.ResponseAppearance.DEFAULT);

        await render(<App appearance={Adw.ResponseAppearance.DESTRUCTIVE} />, options);
        expect(ref.current?.getResponseAppearance("test")).toBe(Adw.ResponseAppearance.DESTRUCTIVE);
    });

    it("updates response enabled state", async () => {
        const ref = createRef<Adw.AlertDialog>();

        function App({ enabled }: { enabled: boolean }) {
            return <AdwAlertDialog ref={ref} heading="Test" responses={[{ id: "test", label: "Test", enabled }]} />;
        }

        await render(<App enabled={true} />, options);
        expect(ref.current?.getResponseEnabled("test")).toBe(true);

        await render(<App enabled={false} />, options);
        expect(ref.current?.getResponseEnabled("test")).toBe(false);
    });
});

describe("render - AlertDialogResponse > AlertDialogNode (4)", () => {
    it("removes responses when list shrinks", async () => {
        const ref = createRef<Adw.AlertDialog>();

        const { rerender } = await renderChildren(
            [
                { id: "always", label: "Always" },
                { id: "extra", label: "Extra" },
            ],
            buildAlertDialog(ref),
            options,
        );
        expect(ref.current?.hasResponse("always")).toBe(true);
        expect(ref.current?.hasResponse("extra")).toBe(true);

        await rerender([{ id: "always", label: "Always" }]);
        expect(ref.current?.hasResponse("always")).toBe(true);
        expect(ref.current?.hasResponse("extra")).toBe(false);
    });

    it("handles inserting responses dynamically", async () => {
        const ref = createRef<Adw.AlertDialog>();

        const { rerender } = await renderChildren(
            [
                { id: "first", label: "First" },
                { id: "last", label: "Last" },
            ],
            buildAlertDialog(ref),
            options,
        );
        expect(ref.current?.hasResponse("first")).toBe(true);
        expect(ref.current?.hasResponse("middle")).toBe(false);
        expect(ref.current?.hasResponse("last")).toBe(true);

        await rerender([
            { id: "first", label: "First" },
            { id: "middle", label: "Middle" },
            { id: "last", label: "Last" },
        ]);
        expect(ref.current?.hasResponse("first")).toBe(true);
        expect(ref.current?.hasResponse("middle")).toBe(true);
        expect(ref.current?.hasResponse("last")).toBe(true);
    });
});
