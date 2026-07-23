import { kebabCase } from "@gtkx/utils";

export const propToNotifySignal = (propertyName: string): string => `notify::${kebabCase(propertyName)}`;
