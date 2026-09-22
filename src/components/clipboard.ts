/** 复制到剪贴板：Clipboard API 优先，不可用时回退隐藏 textarea + execCommand。 */
export async function copyText(content: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
    return;
  } catch { /* 继续走回退路径 */ }
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const ta = document.createElement('textarea');
  ta.value = content;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(ta);
  try {
    ta.select();
    if (!document.execCommand('copy')) throw new Error('剪贴板不可用');
  } finally {
    ta.remove();
    previous?.focus({ preventScroll: true });
  }
}
