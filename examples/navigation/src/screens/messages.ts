type Message = {
    id: string;
    sender: string;
    subject: string;
    body: string;
};

const MESSAGES: Message[] = [
    {
        id: "planning",
        sender: "Ada Lovelace",
        subject: "Quarterly planning",
        body: "Could you send over the roadmap draft before Thursday? I would like to review the milestones first.",
    },
    {
        id: "release",
        sender: "Grace Hopper",
        subject: "Release notes for 1.3",
        body: "The changelog looks complete. One question: should the animated style prop get its own section?",
    },
    {
        id: "lunch",
        sender: "Linus Torvalds",
        subject: "Lunch on Friday?",
        body: "A few of us are heading to the new place by the river at noon. Join us if you are free.",
    },
];

const UNKNOWN_MESSAGE: Message = {
    id: "unknown",
    sender: "Nobody",
    subject: "Message not found",
    body: "This message no longer exists.",
};

const findMessage = (id: string): Message => MESSAGES.find((message) => message.id === id) ?? UNKNOWN_MESSAGE;

export { findMessage, MESSAGES };
