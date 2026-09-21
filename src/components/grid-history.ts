/**
 * DataGrid 撤销/重做历史栈 —— 纯数据结构，与 React 解耦以便单测。
 *
 * 模型：
 * - 任何结构性变更（粘贴/增删行/批量/导入）在应用前调用 `record(变更前行)`；
 * - 键盘逐格输入采用「聚焦快照 → 失焦/换格提交」：focus 时 `snapshot(当前行)`，
 *   blur 时若内容有变调用 `commitSnapshot()` 把快照压入撤销栈；
 * - 每次新变更清空 redo 栈；undo/redo 返回目标状态，由调用方应用。
 */
export function cloneRows(rows: string[][]): string[][] {
  return rows.map((r) => [...r]);
}

export function rowsEqual(a: string[][], b: string[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

export class GridHistory {
  private undoStack: string[][][] = [];
  private redoStack: string[][][] = [];
  private pending: string[][] | null = null;

  constructor(private limit = 100) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** 结构性变更：记录变更前状态（内部深拷贝），并丢弃 redo */
  record(prevRows: string[][]): void {
    this.undoStack.push(cloneRows(prevRows));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  /** 键盘编辑开始（聚焦某格时调用）：记住编辑起始状态；已有未提交快照时不覆盖（聚焦期间幂等） */
  snapshot(currentRows: string[][]): void {
    if (this.pending) return;
    this.pending = cloneRows(currentRows);
  }

  /**
   * 键盘编辑结束（失焦/提交时调用）：
   * 若当前状态与起始快照不同，把起始快照压入撤销栈并清空 redo。
   */
  commitSnapshot(currentRows: string[][]): void {
    if (!this.pending) return;
    if (!rowsEqual(this.pending, currentRows)) {
      this.undoStack.push(this.pending);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
      this.redoStack = [];
    }
    this.pending = null;
  }

  /** 放弃未提交的快照（如组件卸载前） */
  dropSnapshot(): void {
    this.pending = null;
  }

  /** 撤销：返回应恢复的状态；调用方负责 onChange 应用。空栈返回 null。 */
  undo(currentRows: string[][]): string[][] | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(cloneRows(currentRows));
    return prev;
  }

  /** 重做：返回应恢复的状态；空栈返回 null。 */
  redo(currentRows: string[][]): string[][] | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(cloneRows(currentRows));
    return next;
  }
}
