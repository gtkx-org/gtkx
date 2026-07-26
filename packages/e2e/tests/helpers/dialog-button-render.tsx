import { render } from "@gtkx/testing";
import { createRef, type ReactElement, type RefObject } from "react";
import { expect } from "vitest";

type DialogButtonDialog = {
    getTitle(): string | null;
    getModal(): boolean;
};

type DialogButtonWidget = {
    getDialog(): DialogButtonDialog | null;
};

type DialogButtonFactory<Widget extends DialogButtonWidget> = (
    ref: RefObject<Widget | null>,
    dialogProps: { title?: string; modal?: boolean },
) => ReactElement;

const expectDialogTitleTracksProp = async <Widget extends DialogButtonWidget>(
    renderButton: DialogButtonFactory<Widget>,
): Promise<void> => {
    const ref = createRef<Widget>();

    function App({ title }: { title: string }) {
        return renderButton(ref, { title });
    }

    await render(<App title="First Title" />);
    expect(ref.current?.getDialog()?.getTitle()).toBe("First Title");
    await render(<App title="Second Title" />);
    expect(ref.current?.getDialog()?.getTitle()).toBe("Second Title");
};

const expectDialogModalProp = async <Widget extends DialogButtonWidget>(
    renderButton: DialogButtonFactory<Widget>,
): Promise<void> => {
    const ref = createRef<Widget>();
    await render(renderButton(ref, { modal: false }));
    expect(ref.current).not.toBeNull();
    const dialog = ref.current?.getDialog();
    expect(dialog?.getModal()).toBe(false);
};

export { expectDialogTitleTracksProp, expectDialogModalProp, type DialogButtonWidget, type DialogButtonFactory };
