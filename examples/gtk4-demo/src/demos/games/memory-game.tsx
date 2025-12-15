import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { useCallback, useEffect, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const SYMBOLS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const GRID_SIZE = 4;
const TOTAL_PAIRS = 8;

type Card = {
    id: number;
    symbol: string;
    isFlipped: boolean;
    isMatched: boolean;
};

const createCards = (): Card[] => {
    const symbols = SYMBOLS.slice(0, TOTAL_PAIRS);
    const pairs = [...symbols, ...symbols];

    for (let i = pairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = pairs[i];
        const other = pairs[j];
        if (temp !== undefined && other !== undefined) {
            pairs[i] = other;
            pairs[j] = temp;
        }
    }

    return pairs.map((symbol, index) => ({
        id: index,
        symbol: symbol ?? "",
        isFlipped: false,
        isMatched: false,
    }));
};

const cardStyle = css`
    min-width: 60px;
    min-height: 60px;
    font-size: 24px;
    font-weight: bold;
`;

const hiddenCardStyle = css`
    min-width: 60px;
    min-height: 60px;
    font-size: 20px;
`;

const CardButton = ({
    card,
    isChecking,
    isGameWon,
    onClick,
}: {
    card: Card;
    isChecking: boolean;
    isGameWon: boolean;
    onClick: () => void;
}) => {
    const isRevealed = card.isFlipped || card.isMatched;

    return (
        <Button
            label={isRevealed ? card.symbol : "?"}
            cssClasses={[
                isRevealed ? cardStyle : hiddenCardStyle,
                card.isMatched ? "success" : "",
                card.isFlipped && !card.isMatched ? "suggested-action" : "",
            ]}
            onClicked={onClick}
            sensitive={!isRevealed && !isChecking && !isGameWon}
        />
    );
};

const MemoryGameDemo = () => {
    const [cards, setCards] = useState<Card[]>(createCards);
    const [flippedCards, setFlippedCards] = useState<number[]>([]);
    const [moves, setMoves] = useState(0);
    const [matches, setMatches] = useState(0);
    const [isChecking, setIsChecking] = useState(false);

    const isGameWon = matches === TOTAL_PAIRS;

    useEffect(() => {
        if (flippedCards.length === 2) {
            setIsChecking(true);
            const [first, second] = flippedCards;
            const firstCard = cards.find((c) => c.id === first);
            const secondCard = cards.find((c) => c.id === second);

            if (firstCard && secondCard && firstCard.symbol === secondCard.symbol) {
                setTimeout(() => {
                    setCards((prev) =>
                        prev.map((card) =>
                            card.id === first || card.id === second ? { ...card, isMatched: true } : card,
                        ),
                    );
                    setMatches((m) => m + 1);
                    setFlippedCards([]);
                    setIsChecking(false);
                }, 500);
            } else {
                setTimeout(() => {
                    setCards((prev) =>
                        prev.map((card) =>
                            card.id === first || card.id === second ? { ...card, isFlipped: false } : card,
                        ),
                    );
                    setFlippedCards([]);
                    setIsChecking(false);
                }, 1000);
            }
        }
    }, [flippedCards, cards]);

    const handleCardClick = useCallback(
        (cardId: number) => {
            if (isChecking || flippedCards.length >= 2) return;

            const card = cards.find((c) => c.id === cardId);
            if (!card || card.isFlipped || card.isMatched) return;

            setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c)));
            setFlippedCards((prev) => [...prev, cardId]);
            setMoves((m) => m + 1);
        },
        [cards, flippedCards, isChecking],
    );

    const handleNewGame = useCallback(() => {
        setCards(createCards());
        setFlippedCards([]);
        setMoves(0);
        setMatches(0);
        setIsChecking(false);
    }, []);

    const getRow = (rowIndex: number) => {
        const startIdx = rowIndex * GRID_SIZE;
        return cards.slice(startIdx, startIdx + GRID_SIZE);
    };

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Memory Game" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label
                    label="Find all matching pairs! Click cards to flip them and try to remember where each symbol is located."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={20}>
                <Label label={`Moves: ${moves}`} cssClasses={["heading"]} />
                <Label label={`Matches: ${matches}/${TOTAL_PAIRS}`} cssClasses={["heading"]} />
                {isGameWon && <Label label="You Win!" cssClasses={["success"]} />}
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.CENTER} spacing={6}>
                {[0, 1, 2, 3].map((rowIdx) => (
                    <Box key={rowIdx} orientation={Gtk.Orientation.HORIZONTAL} spacing={6} homogeneous>
                        {getRow(rowIdx).map((card) => (
                            <CardButton
                                key={card.id}
                                card={card}
                                isChecking={isChecking}
                                isGameWon={isGameWon}
                                onClick={() => handleCardClick(card.id)}
                            />
                        ))}
                    </Box>
                ))}
            </Box>

            <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER}>
                <Button label="New Game" cssClasses={["destructive-action"]} onClicked={handleNewGame} />
            </Box>
        </Box>
    );
};

export const memoryGameDemo: Demo = {
    id: "memory-game",
    title: "Memory Game",
    description: "Classic card matching memory game.",
    keywords: ["game", "memory", "cards", "matching", "interactive"],
    component: MemoryGameDemo,
    sourcePath: getSourcePath(import.meta.url, "memory-game.tsx"),
};
