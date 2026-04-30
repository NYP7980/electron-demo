// src/components/game/JungleChessBoard.tsx
// Jungle Chess (Dou Shou Qi) board: 7×9 grid with river/trap/den terrain
import React, { useState } from 'react';
import {
    JungleChessState,
    JunglePiece,
    JungleAnimal,
    JungleMove,
    Side,
    TERRAIN,
    getValidMoves,
    getPieceAt,
} from '../../games/jungleChess';
import './JungleChessBoard.css';

interface JungleChessBoardProps {
    state: JungleChessState;
    mySide: Side | null;
    myTurn: boolean;
    onMove: (move: JungleMove) => void;
}

const ANIMAL_LABELS: Record<JungleAnimal, string> = {
    elephant: '象',
    lion: '狮',
    tiger: '虎',
    leopard: '豹',
    wolf: '狼',
    dog: '狗',
    cat: '猫',
    rat: '鼠',
};

const TERRAIN_LABELS: Record<string, string> = {
    land: '',
    river: '水',
    trap: '陷',
    den: '穴',
};

const CELL_W = 60;
const CELL_H = 56;

export default function JungleChessBoard({ state, mySide, myTurn, onMove }: JungleChessBoardProps) {
    const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
    const [validMoveSet, setValidMoveSet] = useState<Set<string>>(new Set());

    const { currentTurn, winner } = state;

    const handleCellClick = (row: number, col: number) => {
        if (winner !== null) return;
        if (!myTurn || mySide === null) return;

        const clickedPiece = getPieceAt(state, row, col);

        if (selectedPieceId) {
            const key = `${row},${col}`;
            if (validMoveSet.has(key)) {
                const piece = state.pieces.find(p => p.id === selectedPieceId);
                if (piece) {
                    onMove({ fromRow: piece.row, fromCol: piece.col, toRow: row, toCol: col });
                }
                setSelectedPieceId(null);
                setValidMoveSet(new Set());
                return;
            }
            // Re-select own piece
            if (clickedPiece && clickedPiece.side === mySide) {
                selectPiece(clickedPiece.id);
                return;
            }
            // Deselect
            setSelectedPieceId(null);
            setValidMoveSet(new Set());
            return;
        }

        if (clickedPiece && clickedPiece.side === mySide && clickedPiece.alive) {
            selectPiece(clickedPiece.id);
        }
    };

    const selectPiece = (pieceId: string) => {
        const moves = getValidMoves(state, pieceId);
        const keys = new Set(moves.map(m => `${m.toRow},${m.toCol}`));
        setSelectedPieceId(pieceId);
        setValidMoveSet(keys);
    };

    const renderCell = (row: number, col: number) => {
        const terrain = TERRAIN[row][col];
        const piece = state.pieces.find(p => p.alive && p.row === row && p.col === col);
        const isSelected = piece?.id === selectedPieceId;
        const isValidTarget = validMoveSet.has(`${row},${col}`);

        const cellClasses = [
            'jungle-cell',
            `jungle-cell--${terrain}`,
            isSelected ? 'jungle-cell--selected' : '',
            isValidTarget ? 'jungle-cell--valid-target' : '',
        ].filter(Boolean).join(' ');

        const terrainLabel = TERRAIN_LABELS[terrain];

        return (
            <div
                key={`${row}-${col}`}
                className={cellClasses}
                style={{ width: CELL_W, height: CELL_H }}
                onClick={() => handleCellClick(row, col)}
                role="gridcell"
                aria-label={`${terrain} 行${row + 1} 列${col + 1}${piece ? ` ${piece.side === mySide ? ANIMAL_LABELS[piece.animal] : '敌方'}` : ''}`}
            >
                {terrainLabel && (
                    <span className="jungle-cell__terrain-label" aria-hidden="true">{terrainLabel}</span>
                )}
                {piece && (
                    <div className={`jungle-piece jungle-piece--${piece.side}${isSelected ? ' jungle-piece--selected' : ''}`}>
                        {ANIMAL_LABELS[piece.animal]}
                    </div>
                )}
                {isValidTarget && !piece && (
                    <div className="jungle-cell__move-dot" aria-hidden="true" />
                )}
                {isValidTarget && piece && (
                    <div className="jungle-cell__capture-ring" aria-hidden="true" />
                )}
            </div>
        );
    };

    return (
        <div className="jungle-board-wrapper">
            {/* Status */}
            <div className="jungle-status">
                {winner ? (
                    <span className="jungle-status__winner" role="status">
                        {winner === mySide ? '🎉 你赢了！' : `${winner === 'red' ? '红方' : '蓝方'}获胜`}
                    </span>
                ) : (
                    <span className="jungle-status__turn" role="status">
                        {myTurn ? '轮到你了' : `等待${currentTurn === 'red' ? '红方' : '蓝方'}行棋…`}
                    </span>
                )}
            </div>

            {/* Board */}
            <div
                className="jungle-board"
                style={{
                    gridTemplateColumns: `repeat(7, ${CELL_W}px)`,
                    gridTemplateRows: `repeat(9, ${CELL_H}px)`,
                }}
                role="grid"
                aria-label="斗兽棋棋盘"
            >
                {Array.from({ length: 9 }, (_, r) =>
                    Array.from({ length: 7 }, (_, c) => renderCell(r, c))
                )}
            </div>

            {/* Legend */}
            <div className="jungle-legend">
                <span className="jungle-legend__item jungle-legend__item--river">水 = 河流</span>
                <span className="jungle-legend__item jungle-legend__item--trap">陷 = 陷阱</span>
                <span className="jungle-legend__item jungle-legend__item--den">穴 = 兽穴</span>
            </div>
        </div>
    );
}
