import { toCamelCase, toKebabCase } from "@gtkx/utils";

export const NOTIFY_SIGNAL = "notify";

export const NOTIFY_DETAIL_PREFIX = "notify::";

export const propToNotifySignal = (property: string): `notify::${string}` =>
    `${NOTIFY_DETAIL_PREFIX}${toKebabCase(property)}`;

export const notifyDetailToProp = (detail: string): string => toCamelCase(detail.slice(NOTIFY_DETAIL_PREFIX.length));
