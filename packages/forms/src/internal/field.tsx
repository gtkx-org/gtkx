import type { ControllerFieldState, ControllerRenderProps, UseControllerProps } from "react-hook-form";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkEventControllerFocus } from "@gtkx/jsx/gtk";
import { useMergedRef } from "@gtkx/react/internal";
import { createLogger, type DistributedOmit, type Logger, omit } from "@gtkx/utils";
import {
    type ReactElement,
    type ReactNode,
    type Ref,
    type RefCallback,
    type RefObject,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

type FormFieldPropName = keyof UseControllerProps;

type FieldWidget = {
    grabFocus: () => boolean;
};

type EditableFieldWidget = FieldWidget & Pick<Gtk.Editable, "getDelegate" | "selectRegion">;

type FieldWidgetOptions<Widget extends FieldWidget> = {
    ref?: Ref<Widget> | undefined;
    controllers?: ReactNode | null | undefined;
    cssClasses?: string[] | null | undefined;
    sensitive?: boolean | null | undefined;
    tooltipText?: string | null | undefined;
};

type FieldBinding = Pick<ControllerRenderProps, "ref" | "disabled" | "onBlur">;

type EditableFieldBinding = FieldBinding & Pick<ControllerRenderProps, "name">;

type ShownValue<Widget, Value> = {
    value: Value;
    read: (widget: Widget) => Value;
};

type FieldState = Pick<ControllerFieldState, "invalid" | "error">;

type FieldWidgetBinding<Widget extends FieldWidget> = {
    ref: Ref<Widget>;
    controllers: ReactElement;
    cssClasses: string[] | null | undefined;
    sensitive: boolean | null | undefined;
    tooltipText: string | null | undefined;
    accessibleInvalid: Gtk.AccessibleInvalidState;
};

const log: Logger = createLogger("forms");

const FORM_FIELD_PROP_NAMES: FormFieldPropName[] = [
    "control",
    "defaultValue",
    "disabled",
    "exact",
    "name",
    "rules",
    "shouldUnregister",
];

const withErrorClass = (cssClasses: string[] | null | undefined, isInvalid: boolean): string[] | null | undefined => {
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
    sensitive: field.disabled !== true && props.sensitive,
    tooltipText: state.invalid && state.error?.message !== undefined ? state.error.message : props.tooltipText,
    accessibleInvalid: (state.invalid && Gtk.AccessibleInvalidState.TRUE) || Gtk.AccessibleInvalidState.FALSE,
});

const selectText = (row: EditableFieldWidget): void => {
    row.selectRegion(0, -1);
};

const useCoercedValue = <Widget, Value>(
    widgetRef: RefObject<Widget | null>,
    name: string,
    shown: ShownValue<Widget, Value>,
): boolean => {
    const [isCoerced, setIsCoerced] = useState(false);
    const warnedValue = useRef<{ value: Value } | null>(null);

    useLayoutEffect(() => {
        const widget = widgetRef.current;
        const shownValue = widget === null ? shown.value : shown.read(widget);
        const isMismatch = !Object.is(shownValue, shown.value);
        setIsCoerced(isMismatch);

        if (!isMismatch || Object.is(warnedValue.current?.value, shown.value)) {
            return;
        }

        warnedValue.current = { value: shown.value };

        if (process.env.NODE_ENV !== "production") {
            log.warn(
                `Form field "${name}" holds ${JSON.stringify(shown.value)}, but its row shows ${JSON.stringify(shownValue)}; the row is marked invalid until an edit replaces the value`,
            );
        }
    });

    return isCoerced;
};

const useEditableFieldWidget = <Widget extends EditableFieldWidget, Value>(
    field: EditableFieldBinding,
    state: FieldState,
    props: FieldWidgetOptions<Widget>,
    shown: ShownValue<Widget, Value>,
): FieldWidgetBinding<Widget> => {
    const widgetRef = useRef<Widget | null>(null);
    const isCoerced = useCoercedValue(widgetRef, field.name, shown);
    const binding = useFieldWidget(
        field,
        { ...state, invalid: state.invalid || isCoerced },
        { ...props, ref: useMergedRef(props.ref, widgetRef) },
        selectText,
    );

    useLayoutEffect(() => {
        widgetRef.current?.getDelegate()?.updateState([Gtk.AccessibleState.INVALID], [binding.accessibleInvalid]);
    }, [binding.accessibleInvalid]);

    return binding;
};

const widgetProps = <Props extends Partial<Record<FormFieldPropName, unknown>>>(
    props: Props,
): DistributedOmit<Props, FormFieldPropName> => omit(props, FORM_FIELD_PROP_NAMES);

export { useEditableFieldWidget, useFieldWidget, widgetProps };
