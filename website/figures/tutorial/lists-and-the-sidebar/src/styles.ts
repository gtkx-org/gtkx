import { css } from "@gtkx/css";

export const listDot = (color: string): string => css`
    min-width: 12px;
    min-height: 12px;
    border-radius: 9999px;
    background: ${color};
`;
