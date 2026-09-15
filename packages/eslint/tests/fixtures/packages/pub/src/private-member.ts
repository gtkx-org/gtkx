type Secret = {
    value: string;
};

class PublicBox {
    private secret: Secret = { value: "ready" };

    getValue(): string {
        return this.secret.value;
    }
}

export { PublicBox };
