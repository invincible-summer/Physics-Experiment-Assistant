/**
 * 基础 UI 原语 —— 按钮、徽章、面板、提示、对话框、toast 等。
 * 约定（AGENTS.md §12）：所有可见文案必须是 Markdown 源字符串，
 * 经 MarkdownInline/markdownInlineNode 渲染；交互控件内 allowLinks={false}。
 */
import { ButtonHTMLAttributes, ReactNode, useEffect, useRef, useState } from 'react';
import { Provenance, PROVENANCE_LABELS } from '../standards/types';
import { Tex } from './katex';
import { MarkdownInline, MarkdownList, markdownInlineNode } from './Markdown';

/* ---------- 按钮 ---------- */
export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
}

export function Button({ variant = 'default', size = 'md', className = '', type = 'button', children, ...rest }: ButtonProps) {
  const cls = ['btn', variant !== 'default' && `btn-${variant}`, size === 'sm' && 'btn-sm', className]
    .filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {markdownInlineNode(children, false)}
    </button>
  );
}

/* ---------- 徽章 ---------- */
export type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ variant = 'default', children, title }: {
  variant?: BadgeVariant; children: ReactNode; title?: string;
}) {
  return <span className={`badge badge-${variant}`} title={title}>{markdownInlineNode(children)}</span>;
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
    <span className={`badge badge-${variant}`} title={title}>
      <MarkdownInline allowLinks={false}>{PROVENANCE_LABELS[provenance.status]}</MarkdownInline>
    </span>
  );
}

/* ---------- 面板 ---------- */
export function Panel({ title, sub, actions, children, id, className = '' }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string; className?: string;
}) {
  return (
    <section className={`panel${className ? ` ${className}` : ''}`} id={id}>
      {(title || sub || actions) && (
        <div className="panel-head">
          <div className="panel-heading">
            {title && <div className="panel-title">{markdownInlineNode(title)}</div>}
            {sub && <div className="panel-sub">{markdownInlineNode(sub)}</div>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}

/* ---------- 提示 / 公告（全部走 Markdown 渲染，支持公式） ---------- */
export type NoticeVariant = 'info' | 'success' | 'warning' | 'danger';

export function Notice({ variant = 'info', title, children, className = '' }: {
  variant?: NoticeVariant; title?: string; children: ReactNode; className?: string;
}) {
  return (
    <div
      className={`notice notice-${variant}${className ? ` ${className}` : ''}`}
      role={variant === 'warning' || variant === 'danger' ? 'alert' : undefined}
    >
      <div className="n-body">
        {title && <div className="n-title"><MarkdownInline>{title}</MarkdownInline></div>}
        {children}
      </div>
    </div>
  );
}

export function SafetyNotice({ items, compact = false }: { items: string[]; compact?: boolean }) {
  if (items.length === 0) return null;
  if (compact) {
    return (
      <Notice variant="warning" title="安全提示">
        <MarkdownList items={items} />
      </Notice>
    );
  }
  return (
    <div className="safety-banner" role="alert">
      <div className="safety-banner-inner">
        <div className="n-title"><MarkdownInline>安全须知（请先阅读，操作以教师现场要求为准）</MarkdownInline></div>
        <MarkdownList items={items} />
      </div>
    </div>
  );
}

/* ---------- 复制按钮 ---------- */
export function CopyButton({ text, label = '复制', onCopied, size = 'sm' }: {
  text: string | (() => string); label?: string; onCopied?: () => void; size?: 'md' | 'sm';
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size={size}
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
    </Button>
  );
}

/* ---------- 对话框 ---------- */
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
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-card${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <span className="modal-title"><MarkdownInline>{title}</MarkdownInline></span>
          <Button size="sm" variant="ghost" onClick={onClose}>关闭</Button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- 空状态 ---------- */
export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-title"><MarkdownInline>{title}</MarkdownInline></div>
      {hint && <div className="small muted"><MarkdownInline>{hint}</MarkdownInline></div>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}

/* ---------- 公式块 ---------- */
export function FormulaBlock({ latex, display = true }: { latex: string; display?: boolean }) {
  return (
    <div className="formula-block">
      <Tex tex={latex} display={display} />
    </div>
  );
}

/* ---------- 标签页 ---------- */
export function Tabs({ tabs, active, onChange, ariaLabel }: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === active}
          className={`tab${t.id === active ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <MarkdownInline allowLinks={false}>{t.label}</MarkdownInline>
        </button>
      ))}
    </div>
  );
}

/* ---------- 表单字段 ---------- */
export function Field({ label, hint, error, children }: {
  label?: ReactNode; hint?: string; error?: string; children: ReactNode;
}) {
  return (
    <div className="field">
      {label && <div className="field-label">{markdownInlineNode(label)}</div>}
      {children}
      {error && <div className="field-error"><MarkdownInline>{error}</MarkdownInline></div>}
      {!error && hint && <div className="field-help"><MarkdownInline>{hint}</MarkdownInline></div>}
    </div>
  );
}

/* ---------- toast ---------- */
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
      {list.map((t) => <div key={t.id} className="toast"><MarkdownInline>{t.text}</MarkdownInline></div>)}
    </div>
  );
}

/* ---------- 二次确认按钮（AGENTS.md §13） ---------- */
export function ConfirmButton({ onConfirm, children, question, variant = 'default', size = 'md', title }: {
  onConfirm: () => void; children: ReactNode; question: string; variant?: ButtonVariant; size?: 'md' | 'sm'; title?: string;
}) {
  const [arm, setArm] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Button
      variant={arm ? 'danger' : variant}
      size={size}
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
    </Button>
  );
}
