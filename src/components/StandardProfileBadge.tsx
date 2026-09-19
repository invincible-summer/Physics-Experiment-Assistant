/** 当前标准配置徽章（plan §19 组件清单） */
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../stores/settings';
import { Badge, BadgeVariant } from './ui';

export function StandardProfileBadge({ clickable = true }: { clickable?: boolean }) {
  const profile = useSettings((s) => s.activeProfile());
  const navigate = useNavigate();
  const variant: BadgeVariant = profile.kind === 'course' ? 'accent' : profile.kind === 'gbt' ? 'info' : 'warning';
  const el = (
    <Badge variant={variant} title={profile.description}>
      标准：{profile.shortName}
      {profile.kind === 'custom' ? '（不代表课程或 GB/T）' : ''}
    </Badge>
  );
  if (!clickable) return el;
  return (
    <button
      style={{ all: 'unset', cursor: 'pointer' }}
      onClick={() => navigate('/settings')}
      title="前往设置切换标准"
    >
      {el}
    </button>
  );
}
