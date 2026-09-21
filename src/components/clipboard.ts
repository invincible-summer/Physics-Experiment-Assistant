/** 复制到剪贴板：Clipboard API 优先，不可用时回退隐藏 textarea + execCommand。 */
export async function copyText(content: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
    return;
  } catch { /* 继续走回退路径 */ }
  const ta = document.createElement('textarea');
  ta.value = content;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}
