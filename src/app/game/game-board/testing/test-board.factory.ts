import { GameBoardTile } from '../models/game-board-tile';

/**
 * Create a test game board with spawner at (0,0) and exit at (size-1, size-1).
 * All other tiles are base (traversable). Optional blocked cells become walls
 * (non-traversable), simulating placed towers or hard walls.
 */
export function createTestBoard(
  size = 10,
  blockedCells: { row: number; col: number }[] = []
): GameBoardTile[][] {
  const blocked = new Set(blockedCells.map(c => `${c.row}-${c.col}`));
  const board: GameBoardTile[][] = [];
  for (let row = 0; row < size; row++) {
    board[row] = [];
    for (let col = 0; col < size; col++) {
      if (row === 0 && col === 0) {
        board[row][col] = GameBoardTile.createSpawner(row, col);
      } else if (row === size - 1 && col === size - 1) {
        board[row][col] = GameBoardTile.createExit(row, col);
      } else if (blocked.has(`${row}-${col}`)) {
        board[row][col] = GameBoardTile.createWall(row, col);
      } else {
        board[row][col] = GameBoardTile.createBase(row, col);
      }
    }
  }
  return board;
}
