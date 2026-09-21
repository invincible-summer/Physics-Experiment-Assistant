/**
 * 工作台步骤导航 stepper：桌面竖排（连接线 + 状态点），≤900px 变 sticky 横滚条（CSS 驱动）。
 * status：done=已完成 todo=未开始 attention=有警告/排除数据；当前步由 active 表达。
 */
import { Icon } from '../../components/Icon';
import { MarkdownInline } from '../../components/Markdown';

export type StepStatus = 'done' | 'todo' | 'attention';

export interface StepNavEntry {
  id: string;
  title: string;
  status?: StepStatus;
}

export function StepNav({ steps, currentId, onSelect, label = '实验步骤' }: {
  steps: StepNavEntry[];
  currentId: string;
  onSelect: (id: string) => void;
  label?: string;
}) {
  return (
    <nav className="step-nav" aria-label={label}>
      <ol className="step-nav-list">
        {steps.map((step, i) => {
          const active = step.id === currentId;
          const status = step.status ?? 'todo';
          return (
            <li key={step.id} className={status !== 'todo' ? `step-${status}` : undefined}>
              <button
                className={`step-item${active ? ' active' : ''}`}
                onClick={() => onSelect(step.id)}
                aria-current={active ? 'step' : undefined}
              >
                <span className="step-num" aria-hidden>
                  {status === 'done' ? <Icon name="check" size={12} />
                    : status === 'attention' ? <Icon name="alert" size={12} />
                    : i + 1}
                </span>
                <span className="step-title"><MarkdownInline allowLinks={false}>{step.title}</MarkdownInline></span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
