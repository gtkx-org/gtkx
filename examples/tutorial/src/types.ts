export type Note = {
    id: string;
    title: string;
    body: string;
    createdAt: Date;
    favorite?: boolean;
    deleted?: boolean;
};

export type Category = {
    id: string;
    title: string;
    icon: string;
};
