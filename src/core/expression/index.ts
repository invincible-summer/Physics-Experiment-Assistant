/**
 * core/expression — 安全表达式引擎（AGENTS.md §8：禁止 eval/new Function）。
 *
 * 基于 mathjs 的 AST：parse → 符号校验 → evaluate（AST 解释执行，非 JS eval）。
 * 支持：符号别名、求值、对变量求导（mathjs derivative）、生成 LaTeX、
 * 显式解优先/受限数值求根的 solveFor。
 */
import { parse, derivative, MathNode, SymbolNode } from 'mathjs';

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpressionError';
  }
}

/** 允许在表达式中使用的常量与函数（白名单） */
export const ALLOWED_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

export const ALLOWED_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh',
  'exp', 'log', 'ln', 'log10', 'sqrt', 'abs', 'sign',
  'pow', 'min', 'max',
]);

export interface CompiledExpression {
  /** 原始文本 */
  source: string;
  node: MathNode;
  /** 表达式中出现的变量（不含常量与函数名） */
  variables: string[];
}

const NODE_DENYLIST = new Set([
  'FunctionAssignmentNode', 'AssignmentNode', 'BlockNode', 'ConditionalNode',
]);

/** 解析并校验表达式；返回 AST 与变量列表。非法构造直接抛错。 */
export function compileExpression(source: string): CompiledExpression {
  const trimmed = source.trim();
  if (!trimmed) throw new ExpressionError('表达式为空');
  let node: MathNode;
  try {
    node = parse(trimmed);
  } catch (err) {
    throw new ExpressionError(`表达式语法错误：${(err as Error).message}`);
  }
  const vars = new Set<string>();
  node.traverse((n, _path, parent) => {
    const anyNode = n as unknown as { type?: string; name?: string };
    if (NODE_DENYLIST.has(anyNode.type ?? '')) {
      throw new ExpressionError(`表达式包含不允许的构造：${anyNode.type}`);
    }
    if (n.type === 'SymbolNode') {
      const sym = anyNode as SymbolNode;
      const name = sym.name;
      // 函数调用位置
      const isCallee = parent && (parent as unknown as { fn?: MathNode }).fn === n;
      if (isCallee) {
        if (!ALLOWED_FUNCTIONS.has(name)) {
          throw new ExpressionError(`不允许的函数："${name}"`);
        }
        return;
      }
      if (name in ALLOWED_CONSTANTS) return;
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new ExpressionError(`非法变量名："${name}"`);
      }
      vars.add(name);
    }
  });
  return { source: trimmed, node, variables: [...vars] };
}

export function evaluateExpression(
  compiled: CompiledExpression,
  scope: Record<string, number>,
  opts?: { angleMode?: 'rad' | 'deg' },
): number {
  for (const v of compiled.variables) {
    if (!(v in scope) || !Number.isFinite(scope[v])) {
      if (!(v in scope)) throw new ExpressionError(`变量 "${v}" 未赋值`);
    }
  }
  const fullScope: Record<string, unknown> = { ...ALLOWED_CONSTANTS };
  // mathjs 的自然对数是 log()；为公式书写习惯补 ln 别名
  fullScope.ln = Math.log;
  if (opts?.angleMode === 'deg') {
    // 度模式：通过 scope 覆盖三角函数（mathjs scope 优先于内建）
    const d = Math.PI / 180;
    fullScope.sin = (x: number) => Math.sin(x * d);
    fullScope.cos = (x: number) => Math.cos(x * d);
    fullScope.tan = (x: number) => Math.tan(x * d);
    fullScope.asin = (x: number) => Math.asin(x) / d;
    fullScope.acos = (x: number) => Math.acos(x) / d;
    fullScope.atan = (x: number) => Math.atan(x) / d;
  }
  for (const [k, v] of Object.entries(scope)) fullScope[k] = v;
  let value: unknown;
  try {
    value = compiled.node.evaluate({ ...fullScope });
  } catch (err) {
    throw new ExpressionError(`求值失败：${(err as Error).message}`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ExpressionError(`求值结果不是有限数值（可能除零或定义域越界）`);
  }
  return value;
}

/** 符号求导并返回可求值的编译表达式 */
export function derivativeOf(compiled: CompiledExpression, variable: string): CompiledExpression {
  try {
    let d = derivative(compiled.node, variable, { simplify: true });
    if (typeof (d as MathNode).traverse !== 'function') {
      // simplify 在常量结果时可能返回原始数值，重新包成节点
      d = parse(String(d));
    }
    return { source: `d/d${variable}(${compiled.source})`, node: d, variables: extractVariables(d) };
  } catch (err) {
    throw new ExpressionError(`无法对 ${variable} 求导：${(err as Error).message}`);
  }
}

export function extractVariables(node: MathNode): string[] {
  const vars = new Set<string>();
  node.traverse((n, _path, parent) => {
    if (n.type === 'SymbolNode') {
      const isCallee = parent && (parent as unknown as { fn?: MathNode }).fn === n;
      if (isCallee) return;
      const name = (n as SymbolNode).name;
      if (!(name in ALLOWED_CONSTANTS)) vars.add(name);
    }
  });
  return [...vars];
}

/** 生成 LaTeX。别名替换便于课程符号（如 b→b）显示。 */
export function toLatex(compiled: CompiledExpression, symbolMap: Record<string, string> = {}): string {
  const raw = compiled.node.toTex({ parenthesis: 'auto' });
  // mathjs 输出 \cdot 等；对单字母变量做 \mathrm 无必要，保留原样；替换希腊/下标别名
  let tex = raw.replace(/\\cdot/g, ' \\cdot ');
  for (const [from, to] of Object.entries(symbolMap)) {
    if (from === to) continue;
    tex = tex.split(from).join(to);
  }
  return tex;
}

/**
 * 受限数值求根（solveFor 的兜底）：在变量定义域内扫描变号区间后二分。
 * f(x) = expression(variable=x)，其余变量取 scope。
 * 返回 NaN 当扫描失败。区间 [lo, hi] 与扫描步数受限。
 */
export function solveNumeric(
  compiled: CompiledExpression,
  variable: string,
  scope: Record<string, number>,
  center = 1,
  span = 1e7,
): number {
  const f = (x: number) => evaluateExpression(compiled, { ...scope, [variable]: x });
  // 分段扫描：对数网格 + 线性细分
  const scales: number[] = [0];
  for (let mag = -12; mag <= Math.log10(Math.max(span, 1)); mag += 0.5) {
    scales.push(Math.pow(10, mag));
    scales.push(-Math.pow(10, mag));
  }
  const points = scales.map((s) => center + s).filter((x) => Number.isFinite(x) && x !== 0);
  points.sort((a, b) => a - b);
  let lo = 0;
  let hi = 0;
  let found = false;
  let prevX = points[0];
  let prevF = 0;
  try {
    prevF = f(prevX);
  } catch {
    prevF = NaN;
  }
  for (let i = 1; i < points.length; i++) {
    const x = points[i];
    let fx = 0;
    try {
      fx = f(x);
    } catch {
      fx = NaN;
    }
    if (Number.isFinite(prevF) && Number.isFinite(fx) && prevF * fx < 0) {
      lo = prevX;
      hi = x;
      found = true;
      break;
    }
    prevX = x;
    prevF = fx;
  }
  if (!found) return NaN;
  // 二分
  let flo = f(lo);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm === 0 || hi - lo < 1e-15 * Math.max(1, Math.abs(mid))) break;
    if (flo * fm < 0) {
      hi = mid;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}
