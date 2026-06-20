export type RefreshTracker = {
    performRefresh(): void;
    isRefreshing(): boolean;
};

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
