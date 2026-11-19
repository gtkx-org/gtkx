import { GtkButton } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";

type ButtonProps = {
    label: string;
    enabled: boolean;
    onClicked?: () => void;
};

const Button = ({ label, enabled, onClicked }: ButtonProps): ReactNode => (
    <GtkButton label={label} sensitive={enabled} onClicked={onClicked} />
);

export { Button };
