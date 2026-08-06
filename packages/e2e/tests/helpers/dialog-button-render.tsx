import type { GtkColorDialogProps, GtkFontDialogProps } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type ReactElement, type RefObject } from "react";
import { expect } from "vitest";

type DialogSlotProps = Pick<GtkColorDialogProps & GtkFontDialogProps, "title" | "modal">;

type DialogButtonDialog = {
    getTitle(): string | null;
    getModal(): boolean;
};

type DialogButtonWidget = {
    getDialog(): DialogButtonDialog | null;
};

type DialogButtonFactory<Widget extends DialogButtonWidget> = (
    ref: RefObject<Widget | null>,
    dialogProps: DialogSlotProps,
) => ReactElement;

const expectDialogTitleTracksProp = async <Widget extends DialogButtonWidget>(
    renderButton: DialogButtonFactory<Widget>,
): Promise<void> => {
    const ref = createRef<Widget>();

    function App({ title }: { title: string }) {
        return renderButton(ref, { title });
    }

    await render(<App title="First Title" />);
    expect(ref.current?.getDialog()).toHaveObjectProperty("title", "First Title");
    await render(<App title="Second Title" />);
    expect(ref.current?.getDialog()).toHaveObjectProperty("title", "Second Title");
};

const expectDialogModalProp = async <Widget extends DialogButtonWidget>(
    renderButton: DialogButtonFactory<Widget>,
): Promise<void> => {
    const ref = createRef<Widget>();
    await render(renderButton(ref, { modal: false }));
    expect(ref.current).not.toBeNull();
    const dialog = ref.current?.getDialog();
    expect(dialog).toHaveObjectProperty("modal", false);
};

export { expectDialogTitleTracksProp, expectDialogModalProp };
