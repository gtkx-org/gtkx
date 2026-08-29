import type { RefCallBack } from "react-hook-form";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkEventControllerFocus } from "@gtkx/jsx/gtk";
import { omit } from "@gtkx/utils";
import { type ReactElement, type ReactNode, type Ref, type RefCallback, useCallback } from "react";

type FormFieldPropName =
    | "control" |
    "defaultValue" |
    "disabled" |
    "exact" |
    "name" |
    "rules" |
    "shouldUnregister";

type FieldWidget = Gtk.Widget & {
    grabFocus: () => boolean;
};

type FieldWidgetOptions<Widget extends FieldWidget> = {
    ref?: Ref<Widget> | undefined;
    controllers?: ReactNode | null | undefined;
    cssClasses?: string[] | null | undefined;
    sensitive?: boolean | null | undefined;
    tooltipText?: string | null | undefined;
};

type FieldBinding = {
    ref: RefCallBack;
    disabled?: boolean | undefined;
    onBlur: () => void;
};

type FieldState = { invalid: boolean; error?: { message?: string | undefined } | undefined };

type FieldWidgetBinding<Widget extends FieldWidget> = {
    ref: RefCallback<Widget>;
    controllers: ReactElement;
    cssClasses: string[] | null | undefined;
    sensitive: boolean | null | undefined;
    tooltipText: string | null | undefined;
    accessibleInvalid: Gtk.AccessibleInvalidState;
};

const FORM_FIELD_PROP_NAMES: FormFieldPropName[] = [
    "control",
    "defaultValue",
    "disabled",
    "exact",
    "name",
    "rules",
    "shouldUnregister",
];

const setRef = <Widget,>(ref: Ref<Widget> | undefined, widget: Widget | null): void => {
    if (typeof ref === "function") {
        ref(widget);
    } else if (ref !== undefined && ref !== null) {
        ref.current = widget;
    }
};

const withErrorClass = (
    cssClasses: string[] | null | undefined,
    isInvalid: boolean,
): string[] | null | undefined => {
    if (!isInvalid || cssClasses?.includes("error") === true) {
        return cssClasses;
    }

    return [...(cssClasses ?? []), "error"];
};

const useFieldWidgetRef = <Widget extends FieldWidget>({
    field: { ref: controllerRef },
    forwardedRef,
    select,
}: {
    field: FieldBinding;
    forwardedRef: Ref<Widget> | undefined;
    select: ((widget: Widget) => void) | undefined;
}): RefCallback<Widget> =>
    useCallback(
        (widget) => {
            setRef(forwardedRef, widget);

            if (widget === null) {
                controllerRef(null);

                return;
            }

            controllerRef({
                focus: () => {
                    widget.grabFocus();
                },
                ...(select !== undefined && {
                    select: () => {
                        select(widget);
                    },
                }),
            });
        },
        [controllerRef, forwardedRef, select],
    );

const useFieldWidget = <Widget extends FieldWidget>(
    field: FieldBinding,
    state: FieldState,
    props: FieldWidgetOptions<Widget>,
    select?: (widget: Widget) => void,
): FieldWidgetBinding<Widget> => ({
    ref: useFieldWidgetRef({ field, forwardedRef: props.ref, select }),
    controllers: (
        <>
            {props.controllers}
            <GtkEventControllerFocus onLeave={field.onBlur} />
        </>
    ),
    cssClasses: withErrorClass(props.cssClasses, state.invalid),
    sensitive: field.disabled === true ? false : props.sensitive,
    tooltipText: state.invalid && state.error?.message !== undefined ? state.error.message : props.tooltipText,
    accessibleInvalid: state.invalid ? Gtk.AccessibleInvalidState.TRUE : Gtk.AccessibleInvalidState.FALSE,
});

const selectText = (row: { selectRegion: (start: number, end: number) => void }): void => {
    row.selectRegion(0, -1);
};

const widgetProps = <Props extends Partial<Record<FormFieldPropName, unknown>>>(
    props: Props,
): Omit<Props, FormFieldPropName> => omit(props, FORM_FIELD_PROP_NAMES);

export { selectText, useFieldWidget, widgetProps };
