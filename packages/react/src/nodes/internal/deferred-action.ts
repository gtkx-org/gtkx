export class DeferredAction {
    private scheduled = false;

    constructor(private action: () => void) {}

    get isPending(): boolean {
        return this.scheduled;
    }

    schedule(): void {
        if (this.scheduled) return;
        this.scheduled = true;
        queueMicrotask(() => {
            this.scheduled = false;
            this.action();
        });
    }
}
