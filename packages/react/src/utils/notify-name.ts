import { camelCase, kebabCase } from "@gtkx/utils";

export const NOTIFY_SIGNAL = "notify";

export const NOTIFY_DETAIL_PREFIX = "notify::";

export const propToNotifySignal = (property: string): `notify::${string}` =>
    `${NOTIFY_DETAIL_PREFIX}${kebabCase(property)}`;

export const notifyDetailToProp = (detail: string): string => camelCase(detail.slice(NOTIFY_DETAIL_PREFIX.length));
