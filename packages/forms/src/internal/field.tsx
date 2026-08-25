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
    controllerRef: RefCallBack;
    forwardedRef: Ref<Widget> | undefined;
    controllers: ReactNode | null | undefined;
    cssClasses: string[] | null | undefined;
    sensitive: boolean | null | undefined;
    tooltipText: string | null | undefined;
    disabled: boolean | undefined;
    isInvalid: boolean;
    errorMessage: string | undefined;
    select?: ((widget: Widget) => void) | undefined;
};

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
    controllerRef,
    forwardedRef,
    select,
}: Pick<FieldWidgetOptions<Widget>, "controllerRef" | "forwardedRef" | "select">): RefCallback<Widget> =>
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
    options: FieldWidgetOptions<Widget>,
    onBlur: () => void,
): FieldWidgetBinding<Widget> => ({
    ref: useFieldWidgetRef(options),
    controllers: (
        <>
            {options.controllers}
            <GtkEventControllerFocus onLeave={onBlur} />
        </>
    ),
    cssClasses: withErrorClass(options.cssClasses, options.isInvalid),
    sensitive: options.disabled === true ? false : options.sensitive,
    tooltipText: options.isInvalid && options.errorMessage !== undefined ? options.errorMessage : options.tooltipText,
    accessibleInvalid: options.isInvalid ? Gtk.AccessibleInvalidState.TRUE : Gtk.AccessibleInvalidState.FALSE,
});

const widgetProps = <Props extends Partial<Record<FormFieldPropName, unknown>>>(
    props: Props,
): Omit<Props, FormFieldPropName> => omit(props, FORM_FIELD_PROP_NAMES);

export { useFieldWidget, widgetProps };
