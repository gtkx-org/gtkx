import type { ControllerFieldState, ControllerRenderProps, UseControllerProps } from "react-hook-form";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkEventControllerFocus } from "@gtkx/jsx/gtk";
import { useMergedRef } from "@gtkx/react/internal";
import { type DistributedOmit, omit } from "@gtkx/utils";
import { type ReactElement, type ReactNode, type Ref, type RefCallback, useCallback } from "react";

type FormFieldPropName = keyof UseControllerProps;

type FieldWidget = {
    grabFocus: () => boolean;
};

type FieldWidgetOptions<Widget extends FieldWidget> = {
    ref?: Ref<Widget> | undefined;
    controllers?: ReactNode | null | undefined;
    cssClasses?: string[] | null | undefined;
    sensitive?: boolean | null | undefined;
    tooltipText?: string | null | undefined;
};

type FieldBinding = Pick<ControllerRenderProps, "ref" | "disabled" | "onBlur">;

type FieldState = Pick<ControllerFieldState, "invalid" | "error">;

type FieldWidgetBinding<Widget extends FieldWidget> = {
    ref: Ref<Widget>;
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

const withErrorClass = (
    cssClasses: string[] | null | undefined,
    isInvalid: boolean,
): string[] | null | undefined => {
    if (!isInvalid || cssClasses?.includes("error") === true) {
        return cssClasses;
    }

    return [...(cssClasses ?? []), "error"];
};

const useControllerRef = <Widget extends FieldWidget>({
    field: { ref: controllerRef },
    select,
}: {
    field: FieldBinding;
    select: ((widget: Widget) => void) | undefined;
}): RefCallback<Widget> =>
    useCallback(
        (widget) => {
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
        [controllerRef, select],
    );

const useFieldWidget = <Widget extends FieldWidget>(
    field: FieldBinding,
    state: FieldState,
    props: FieldWidgetOptions<Widget>,
    select?: (widget: Widget) => void,
): FieldWidgetBinding<Widget> => ({
    ref: useMergedRef(props.ref, useControllerRef({ field, select })),
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
): DistributedOmit<Props, FormFieldPropName> => omit(props, FORM_FIELD_PROP_NAMES);

export { selectText, useFieldWidget, widgetProps };
