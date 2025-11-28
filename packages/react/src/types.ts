import type { ReactNode } from "react";

export interface SlotProps {
    children?: ReactNode;
}

export interface ItemProps<T> {
    item: T;
}

export interface GridChildProps extends SlotProps {
    column?: number;
    row?: number;
    columnSpan?: number;
    rowSpan?: number;
}
