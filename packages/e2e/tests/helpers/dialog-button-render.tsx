import { render } from "@gtkx/testing";
import { createRef, type ReactElement, type RefObject } from "react";
import { expect } from "vitest";

/** Dialog object exposed by a dialog-button widget under test. */
interface DialogButtonDialog {
    /** Returns the dialog's window title. */
    getTitle(): string | null;
    /** Returns whether the dialog is modal. */
    getModal(): boolean;
}

/** Widget shape shared by the dialog-button widgets under test. */
export interface DialogButtonWidget {
    /** Returns the dialog backing the button, if any. */
    getDialog(): DialogButtonDialog | null;
}

/**
 * Renders a dialog-button widget through a caller-supplied factory, allowing
 * each test file to keep its own precisely typed dialog slot element while
 * sharing the dialog-property assertion sequences below. The factory receives
 * the props to spread onto the button's `dialog` slot element.
 */
export type DialogButtonFactory<Widget extends DialogButtonWidget> = (
    ref: RefObject<Widget | null>,
    dialogProps: { title?: string; modal?: boolean },
) => ReactElement;

/**
 * Renders the dialog-button widget twice with differing dialog slot titles and
 * asserts that `getDialog()` reflects the slot element's title on each render.
 */
export const expectDialogTitleTracksProp = async <Widget extends DialogButtonWidget>(
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

/**
 * Renders the dialog-button widget with a `modal={false}` dialog slot element
 * and asserts that `getDialog()` reports a non-modal state.
 */
export const expectDialogModalProp = async <Widget extends DialogButtonWidget>(
    renderButton: DialogButtonFactory<Widget>,
): Promise<void> => {
    const ref = createRef<Widget>();

    await render(renderButton(ref, { modal: false }));

    expect(ref.current).not.toBeNull();
    const dialog = ref.current?.getDialog();
    expect(dialog?.getModal()).toBe(false);
};
