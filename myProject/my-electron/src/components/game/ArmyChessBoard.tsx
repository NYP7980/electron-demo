// src/components/game/ArmyChessBoard.tsx
// Army Chess (Luzhanqi) board: 5×12 grid with terrain, setup phase, and playing phase
import React, { useState } from 'react';
import {
    ArmyChessState,
    ArmyChessPiece,
    ArmyChessPieceType,
    ArmyChessMove,
    Side,
    TERRAIN,
    getValidMoves,
    getPieceAt,
} from '../../games/armyChess';
import './ArmyChessBoard.css';

interface ArmyChessBoardProps {
    state: ArmyChessState;
    mySide: Side | null;
    myTurn: boolean;
    onMove: (move: ArmyChessMove) => void;
    onConfirmSetup?: (pieces: ArmyChessPiece[]) => void;
}

const PIECE_LABELS: Record<ArmyChessPieceType, string> = {
    commander: '司令',
    lt_general: '军长',
    maj_general: '师长',
    brigadier: '旅长',
    colonel: '团长',
    major: '营长',
    captain: '连长',
    lieutenant: '排长',
    engineer: '工兵',
    landmine: '地雷',
    bomb: '炸弹',
    flag: '军旗',
};

const TERRAIN_LABELS: Record<string, string> = {
    road: '路',
    railway: '铁路',
    camp: '行营',
    hq: '大本营',
    mountain: '山地',
};

const CELL_W = 56;
const CELL_H = 48;

export default function ArmyChessBoard({
    state,
    mySide,
    myTurn,
    onMove,
    onConfirmSetup,
}: ArmyChessBoardProps) {
    const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
    const [validMoveSet, setValidMoveSet] = useState<Set<string>>(new Set());

    // Setup phase: track local arrangement for drag-and-drop / click-to-swap
    const [setupSelected, setSetupSelected] = useState<string | null>(null);

    const { phase, currentTurn, winner } = state;

    const isSetup = phase === 'setup';
    const isPlaying = phase === 'playing';

    // ---- Playing phase: piece selection and move ----
    const handleCellClick = (row: number, col: number) => {
        if (!isPlaying || winner !== null) return;
        if (!myTurn || mySide === null) return;

        const clickedPiece = getPieceAt(state, row, col);

        if (selectedPieceId) {
            const key = `${row},${col}`;
            if (validMoveSet.has(key)) {
                // Execute move
                const piece = state.pieces.find(p => p.id === selectedPieceId);
                if (piece) {
                    onMove({ fromRow: piece.row, fromCol: piece.col, toRow: row, toCol: col });
                }
                setSelectedPieceId(null);
                setValidMoveSet(new Set());
                return;
            }
            // Clicked own piece — re-select
            if (clickedPiece && clickedPiece.side === mySide) {
                selectPiece(clickedPiece.id);
                return;
            }
            // Deselect
            setSelectedPieceId(null);
            setValidMoveSet(new Set());
            return;
        }

        // Select own piece
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

    // ---- Setup phase: click-to-swap within own half ----
    const handleSetupCellClick = (row: number, col: number) => {
        if (!isSetup || mySide === null) return;
        const myRows = mySide === 'red' ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5];
        if (!myRows.includes(row)) return;

        const terrain = TERRAIN[row][col];
        if (terrain === 'mountain') return;

        const clickedPiece = state.pieces.find(
            p => p.alive && p.row === row && p.col === col && p.side === mySide
        );

        if (setupSelected) {
            const fromPiece = state.pieces.find(p => p.id === setupSelected);
            if (!fromPiece) { setSetupSelected(null); return; }

            if (clickedPiece && clickedPiece.id !== setupSelected) {
                // Swap positions — notify parent via onConfirmSetup with swapped arrangement
                const newPieces = state.pieces.map(p => {
                    if (p.id === fromPiece.id) return { ...p, row: clickedPiece.row, col: clickedPiece.col };
                    if (p.id === clickedPiece.id) return { ...p, row: fromPiece.row, col: fromPiece.col };
                    return p;
                });
                onConfirmSetup?.(newPieces);
            } else if (!clickedPiece) {
                // Move to empty cell
                const newPieces = state.pieces.map(p => {
                    if (p.id === fromPiece.id) return { ...p, row, col };
                    return p;
                });
                onConfirmSetup?.(newPieces);
            }
            setSetupSelected(null);
        } else {
            if (clickedPiece) setSetupSelected(clickedPiece.id);
        }
    };

    const handleCellClickDispatch = (row: number, col: number) => {
        if (isSetup) handleSetupCellClick(row, col);
        else handleCellClick(row, col);
    };

    const renderCell = (row: number, col: number) => {
        const terrain = TERRAIN[row][col];
        const piece = state.pieces.find(p => p.alive && p.row === row && p.col === col);
        const isSelected = piece?.id === selectedPieceId || piece?.id === setupSelected;
        const isValidTarget = validMoveSet.has(`${row},${col}`);
        const isOpponent = piece && mySide && piece.side !== mySide;
        const showLabel = piece && (!isOpponent || isSetup);

        const cellClasses = [
            'army-cell',
            `army-cell--${terrain}`,
            isSelected ? 'army-cell--selected' : '',
            isValidTarget ? 'army-cell--valid-target' : '',
        ].filter(Boolean).join(' ');

        return (
            <div
                key={`${row}-${col}`}
                className={cellClasses}
                style={{ width: CELL_W, height: CELL_H }}
                onClick={() => handleCellClickDispatch(row, col)}
                role="gridcell"
                aria-label={`${TERRAIN_LABELS[terrain]} 行${row + 1} 列${col + 1}${piece ? ` ${piece.side === mySide ? PIECE_LABELS[piece.type] : '敌方棋子'}` : ''}`}
                title={terrain === 'mountain' ? '山地（不可通行）' : TERRAIN_LABELS[terrain]}
            >
                <span className="army-cell__terrain-hint">{TERRAIN_LABELS[terrain]}</span>
                {piece && (
                    <div
                        className={`army-piece army-piece--${piece.side}${isSelected ? ' army-piece--selected' : ''}`}
                    >
                        {showLabel ? PIECE_LABELS[piece.type] : '？'}
                    </div>
                )}
                {isValidTarget && !piece && (
                    <div className="army-cell__move-dot" aria-hidden="true" />
                )}
                {isValidTarget && piece && (
                    <div className="army-cell__capture-ring" aria-hidden="true" />
                )}
            </div>
        );
    };

    return (
        <div className="army-board-wrapper">
            {/* Status bar */}
            <div className="army-status">
                {winner ? (
                    <span className="army-status__winner" role="status">
                        {winner === mySide ? '🎉 你赢了！' : `${winner === 'red' ? '红方' : '蓝方'}获胜`}
                    </span>
                ) : isSetup ? (
                    <span className="army-status__info" role="status">
                        {mySide ? `布阵阶段 — 点击棋子后点击目标位置交换` : '等待双方布阵…'}
                    </span>
                ) : (
                    <span className="army-status__turn" role="status">
                        {myTurn ? '轮到你了' : `等待${currentTurn === 'red' ? '红方' : '蓝方'}行棋…`}
                    </span>
                )}
            </div>

            {/* Board grid */}
            <div
                className="army-board"
                style={{ gridTemplateColumns: `repeat(5, ${CELL_W}px)`, gridTemplateRows: `repeat(12, ${CELL_H}px)` }}
                role="grid"
                aria-label="陆战棋棋盘"
            >
                {Array.from({ length: 12 }, (_, r) =>
                    Array.from({ length: 5 }, (_, c) => renderCell(r, c))
                )}
            </div>

            {/* Setup confirm button */}
            {isSetup && mySide && !state.setupConfirmed[mySide] && (
                <button
                    className="army-setup-confirm-btn"
                    onClick={() => onConfirmSetup?.(state.pieces)}
                >
                    确认布阵
                </button>
            )}
            {isSetup && mySide && state.setupConfirmed[mySide] && (
                <p className="army-setup-waiting">已确认布阵，等待对方…</p>
            )}
        </div>
    );
}
