export const escapeMarkup = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const isToday = (iso: string | null): boolean => {
    if (!iso) return false;
    return startOfDay(new Date(iso)) === startOfDay(new Date());
};

export const isOverdue = (iso: string | null): boolean => {
    if (!iso) return false;
    return new Date(iso).getTime() < Date.now();
};

export const formatDue = (iso: string | null): string | null => {
    if (!iso) return null;
    const due = new Date(iso);
    const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000);
    const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (days === 0) return `Today at ${time}`;
    if (days === 1) return `Tomorrow at ${time}`;
    if (days === -1) return `Yesterday at ${time}`;
    if (days < 0) return `${-days} days ago`;
    if (days < 7) return due.toLocaleDateString([], { weekday: "long" });
    return due.toLocaleDateString([], { month: "short", day: "numeric" });
};

export const formatDateTime = (iso: string | null): string => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};
