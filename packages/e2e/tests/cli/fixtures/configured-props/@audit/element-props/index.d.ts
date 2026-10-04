import type { SharedProps } from "@audit/element-base";
import type * as Gtk from "@gtkx/gi/gtk";

interface ButtonProps extends SharedProps<string> {
    auditCount?: number;
    auditWidget?: Gtk.Widget | null;
    auditCallback?: (widget: Gtk.Widget) => boolean;
}
type AliasProps = Omit<ButtonProps, "auditCount"> & {
    auditMode?: "quiet" | "loud";
    [key: `audit-${string}`]: boolean | undefined;
};
declare const ValueProps: { auditValue: string };
declare function FunctionProps(): void;

export type { ReexportedProps } from "./reexport.js";

export { ButtonProps, AliasProps, ValueProps, FunctionProps };
