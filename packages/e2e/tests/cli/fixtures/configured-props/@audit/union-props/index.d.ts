import type * as Gtk from "@gtkx/gi/gtk";
import type { CountKey } from "./keys.js";

type LabelKey = `audit-label-detail-${string}`;
interface Shared<T> { auditShared?: T }
interface Label extends Shared<Gtk.Widget> {
    auditMode: "label";
    auditDynamic: string;
    0: string;
    auditLabel: string;
    auditValue?: string;
    auditCall?: (label: string) => string;
    auditOverlap?: string | number;
    [key: LabelKey]: boolean;
}
interface Count extends Shared<Gtk.Widget> {
    auditMode: "count";
    [key: `auditDynamic${string}`]: number;
    [key: number]: number;
    [key: `audit-label-${string}`]: number;
    auditCount: number;
    auditValue: number;
    auditCall?: (count: number) => number;
    auditOverlap?: number | boolean;
    [key: CountKey]: string;
}
interface Flag {
    auditMode: "flag";
    auditFlag: boolean;
}
type UnionProps = (Label | Count | Flag) & { auditIntersection?: Date };

export type { UnionProps };
