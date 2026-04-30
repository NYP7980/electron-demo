// src/components/game/GomokuBoard.tsx
// 15×15 Gomoku board rendered as SVG with intersection click targets
import React from 'react';
import { GomokuState, GomokuMove, Cell } from '../../games/gomoku';
import './GomokuBoard.css';

interface GomokuBoardProps {
    state: GomokuState;
    myTurn: boolean;
    mySide: 1 | 2 | null;
    lastMove?: GomokuMove | null;
    onMove: (move: GomokuMove) => void;
}

const BOARD_SIZE = 15;
const CELL = 36;          // px per cell
const MARGIN = 28;        // px margin around the grid
const PIECE_R = 14;       // piece radius
const SVG_SIZE = CELL * (BOARD_SIZE - 1) + MARGIN * 2;

function cx(col: number) { return MARGIN + col * CELL; }
function cy(row: number) { return MARGIN + row * CELL; }

export default function GomokuBoard({ state, myTurn, mySide, lastMove, onMove }: GomokuBoardProps) {
    const { board, currentTurn, winner } = state;

    const canPlace = myTurn && winner === null && mySide !== null;

    const handleIntersectionClick = (row: number, col: number) => {
        if (!canPlace) return;
        if (board[row][col] !== 0) return;
        onMove({ row, col });
    };

    // Star points (hoshi) for a 15×15 board
    const starPoints = [
        [3, 3], [3, 7], [3, 11],
        [7, 3], [7, 7], [7, 11],
        [11, 3], [11, 7], [11, 11],
    ];

    return (
        <div className="gomoku-board-wrapper">
            {/* Turn / winner indicator */}
            <div className="gomoku-status">
                {winner !== null ? (
                    <div className="gomoku-status__winner" role="status">
                        {winner === 0
                            ? '平局！'
                            : winner === mySide
                                ? '🎉 你赢了！'
                                : `${winner === 1 ? '黑棋' : '白棋'}获胜`}
                    </div>
                ) : (
                    <div className="gomoku-status__turn" role="status">
                        <span
                            className={`gomoku-status__dot gomoku-status__dot--${currentTurn === 1 ? 'black' : 'white'}`}
                            aria-hidden="true"
                        />
                        {myTurn ? '轮到你了' : `等待${currentTurn === 1 ? '黑棋' : '白棋'}落子…`}
                    </div>
                )}
            </div>

            <svg
                className="gomoku-svg"
                width={SVG_SIZE}
                height={SVG_SIZE}
                aria-label="五子棋棋盘"
                role="grid"
            >
                {/* Board background */}
                <rect x={0} y={0} width={SVG_SIZE} height={SVG_SIZE} fill="#dcb468" rx={6} />

                {/* Grid lines */}
                {Array.from({ length: BOARD_SIZE }, (_, i) => (
                    <React.Fragment key={i}>
                        <line
                            x1={cx(0)} y1={cy(i)} x2={cx(BOARD_SIZE - 1)} y2={cy(i)}
                            stroke="#8b6914" strokeWidth={1}
                        />
                        <line
                            x1={cx(i)} y1={cy(0)} x2={cx(i)} y2={cy(BOARD_SIZE - 1)}
                            stroke="#8b6914" strokeWidth={1}
                        />
                    </React.Fragment>
                ))}

                {/* Star points */}
                {starPoints.map(([r, c]) => (
                    <circle key={`star-${r}-${c}`} cx={cx(c)} cy={cy(r)} r={3} fill="#8b6914" />
                ))}

                {/* Pieces */}
                {board.map((row, r) =>
                    row.map((cell: Cell, c) => {
                        if (cell === 0) return null;
                        const isLast = lastMove?.row === r && lastMove?.col === c;
                        return (
                            <g key={`piece-${r}-${c}`}>
                                <circle
                                    cx={cx(c)}
                                    cy={cy(r)}
                                    r={PIECE_R}
                                    fill={cell === 1 ? '#1a1a1a' : '#f5f5f5'}
                                    stroke={cell === 1 ? '#000' : '#ccc'}
                                    strokeWidth={1}
                                />
                                {isLast && (
                                    <circle
                                        cx={cx(c)}
                                        cy={cy(r)}
                                        r={5}
                                        fill={cell === 1 ? '#f87171' : '#ef4444'}
                                    />
                                )}
                            </g>
                        );
                    })
                )}

                {/* Click targets (invisible, cover each intersection) */}
                {winner === null && board.map((row, r) =>
                    row.map((cell: Cell, c) => (
                        <rect
                            key={`target-${r}-${c}`}
                            x={cx(c) - CELL / 2}
                            y={cy(r) - CELL / 2}
                            width={CELL}
                            height={CELL}
                            fill="transparent"
                            style={{ cursor: canPlace && cell === 0 ? 'pointer' : 'default' }}
                            onClick={() => handleIntersectionClick(r, c)}
                            role="gridcell"
                            aria-label={`行${r + 1} 列${c + 1}${cell !== 0 ? ' 已占用' : ''}`}
                            aria-disabled={!canPlace || cell !== 0}
                        />
                    ))
                )}
            </svg>

            {/* Side legend */}
            <div className="gomoku-legend">
                <span className="gomoku-legend__item">
                    <span className="gomoku-legend__dot gomoku-legend__dot--black" aria-hidden="true" />
                    黑棋{mySide === 1 ? ' (你)' : ''}
                </span>
                <span className="gomoku-legend__item">
                    <span className="gomoku-legend__dot gomoku-legend__dot--white" aria-hidden="true" />
                    白棋{mySide === 2 ? ' (你)' : ''}
                </span>
            </div>
        </div>
    );
}
