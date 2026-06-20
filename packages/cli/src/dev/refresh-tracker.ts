/**
 * Wraps a Fast Refresh trigger so the runner can tell a refresh-induced
 * application unmount apart from an organic quit.
 */
export type RefreshTracker = {
    performRefresh(): void;
    isRefreshing(): boolean;
};

/**
 * Wraps `performRefresh` so the runner can tell a refresh-induced application
 * unmount apart from an organic quit. React flushes the sync work a refresh
 * schedules on a microtask, so the refresh window stays open for one macrotask
 * after the refresh call returns.
 *
 * @param performRefresh - The underlying Fast Refresh trigger.
 * @returns The wrapped trigger and the window predicate.
 */
export const createRefreshTracker = (performRefresh: () => void): RefreshTracker => {
    let refreshing = false;
    return {
        performRefresh: () => {
            refreshing = true;
            try {
                performRefresh();
            } finally {
                setTimeout(() => {
                    refreshing = false;
                }, 0);
            }
        },
        isRefreshing: () => refreshing,
    };
};
