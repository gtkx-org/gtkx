import { t } from "@gtkx/i18n";

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const formatOverdue = (days: number): string =>
    t("{{count}} day ago", {
        count: -days,
        defaultValue_one: "{{count}} day ago",
        defaultValue_other: "{{count}} days ago",
    });

const formatNearbyDue = (days: number, time: string): string | undefined => {
    switch (days) {
        case -1: {
            return t("Yesterday at {{time}}", { time });
        }
        case 0: {
            return t("Today at {{time}}", { time });
        }
        case 1: {
            return t("Tomorrow at {{time}}", { time });
        }
        default: {
            return undefined;
        }
    }
};

const isToday = (iso: string | null): boolean => {
    if (!iso) {
        return false;
    }

    return startOfDay(new Date(iso)) === startOfDay(new Date());
};

const formatDue = (iso: string | null): string | null => {
    if (!iso) {
        return null;
    }
    const due = new Date(iso);
    const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000);
    const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const nearby = formatNearbyDue(days, time);
    if (nearby !== undefined) {
        return nearby;
    }
    if (days < 0) {
        return formatOverdue(days);
    }
    if (days < 7) {
        return due.toLocaleDateString([], { weekday: "long" });
    }

    return due.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatDateTime = (iso: string): string =>
    new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export {
    formatDateTime,
    formatDue,
    isToday,
};
