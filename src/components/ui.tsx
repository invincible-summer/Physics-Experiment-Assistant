/** 通用 UI 组件：徽章、面板、来源、安全提示、复制按钮、对话框等 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Provenance, PROVENANCE_LABELS } from '../standards/types';
import { Tex } from './katex';

export type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ variant = 'default', children, title }: { variant?: BadgeVariant; children: ReactNode; title?: string }) {
  return <span className={`badge badge-${variant}`} title={title}>{children}</span>;
}

export function SourceBadge({ provenance }: { provenance: Provenance }) {
  const variant: BadgeVariant =
    provenance.status === 'source-explicit' ? 'success'
    : provenance.status === 'source-derived' ? 'info'
    : provenance.status === 'general' ? 'default'
    : 'warning';
  const title = [
    PROVENANCE_LABELS[provenance.status],
    provenance.document,
    provenance.section,
    provenance.note,
  ].filter(Boolean).join(' · ');
  return (
    <span className={`badge badge-source ${provenance.status} badge-${variant}`} title={title}>
      {PROVENANCE_LABELS[provenance.status]}
    </span>
  );
}

export function Panel({ title, sub, actions, children, id }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string;
}) {
  return (
    <section className="panel" id={id}>
      {(title || actions) && (
        <div className="panel-title">
          <div className="panel-heading">
            <span>{title}</span>
            {sub && <span className="panel-sub">{sub}</span>}
          </div>
          <span className="spacer" />
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function SafetyNotice({ items, compact = false }: { items: string[]; compact?: boolean }) {
  if (items.length === 0) return null;
  if (compact) {
    return (
      <div className="notice notice-warning" role="alert">
        <div className="n-body">
          <div className="n-title">安全提示</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      </div>
    );
  }
  return (
    <div className="safety-banner" role="alert">
      <div>
        <strong>安全须知（请先阅读，操作以教师现场要求为准）</strong>
        <ul>{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>
    </div>
  );
}

export function CopyButton({ text, label = '复制', onCopied }: { text: string | (() => string); label?: string; onCopied?: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        const content = typeof text === 'function' ? text() : text;
        try {
          await navigator.clipboard.writeText(content);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = content;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setDone(true);
        onCopied?.();
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? '已复制' : label}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal-card${wide ? ' modal-wide' : ''}`}>
        <div className="modal-head">
          <span>{title}</span>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>关闭</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      {hint && <div className="small">{hint}</div>}
    </div>
  );
}

/** 公式 LaTeX 显示块 */
export function FormulaBlock({ latex, display = true }: { latex: string; display?: boolean }) {
  return (
    <div className="formula-card">
      <div className="fc-latex"><Tex tex={latex} display={display} /></div>
    </div>
  );
}

/** toast 通知（轻量本地实现） */
let toastId = 0;
type Toast = { id: number; text: string };
const toastListeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];

export function toast(text: string): void {
  const t = { id: ++toastId, text };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l(toasts));
  }, 2600);
}

export function ToastRegion() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    const l = (t: Toast[]) => setList([...t]);
    toastListeners.add(l);
    return () => { toastListeners.delete(l); };
  }, []);
  if (list.length === 0) return null;
  return (
    <div className="toast-region" role="status">
      {list.map((t) => <div key={t.id} className="toast">{t.text}</div>)}
    </div>
  );
}

/** 确认按钮（清空数据等二次确认，AGENTS.md §13） */
export function ConfirmButton({ onConfirm, children, question, className = 'btn', title }: {
  onConfirm: () => void; children: ReactNode; question: string; className?: string; title?: string;
}) {
  const [arm, setArm] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      className={className}
      title={title ?? question}
      onClick={() => {
        if (!arm) {
          setArm(true);
          timer.current = window.setTimeout(() => setArm(false), 3000);
          return;
        }
        window.clearTimeout(timer.current);
        setArm(false);
        onConfirm();
      }}
    >
      {arm ? '再次点击确认' : children}
    </button>
  );
}
