#!/usr/bin/env bash
# Browser behavior check; requires the installed agent-browser CLI.
set -euo pipefail
url="${1:-http://localhost:8080}"
session="bitstudy-redesign-verify"
trap 'agent-browser --session "$session" close >/dev/null' EXIT
agent-browser --session "$session" open "$url"
for width in 320 375 768 1280 1440; do
  agent-browser --session "$session" set viewport "$width" 900
  agent-browser --session "$session" set media light reduced-motion
  agent-browser --session "$session" eval 'if (document.documentElement.scrollWidth > innerWidth) throw new Error("Horizontal overflow"); true'
done
# Keep DOM assertions in one evaluation; avoid CLI scroll/wait races.
agent-browser --session "$session" eval --stdin <<'JS'
(async () => {
  for (const link of document.querySelectorAll('[data-show-feature]')) {
    link.click();
    if (document.querySelector('[data-feature][aria-pressed=true]').dataset.feature !== link.dataset.showFeature) throw Error('Benefit preview selection');
  }
  for (const key of ['schedule', 'ddl', 'yanhe', 'bitshare']) {
    document.querySelector(`[data-feature=${key}]`).click();
    const image = document.getElementById('screenshot-image');
    await image.decode();
    if (image.naturalWidth !== 1200 || !image.src.endsWith(`${key}.png`)) throw Error('Screenshot mismatch');
    if (document.querySelectorAll('[data-feature][aria-pressed=true]').length !== 1) throw Error('Selection mismatch');
    document.getElementById('screen-zoom').click();
    const dialog = document.getElementById('image-dialog');
    if (!dialog.open || document.activeElement.id !== 'dialog-close') throw Error('Dialog focus');
    document.getElementById('dialog-close').click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (dialog.open || document.activeElement.id !== 'screen-zoom') throw Error('Close/focus restore');
  }
  document.querySelector('[data-feature=yanhe]').click();
  if (document.getElementById('lesson-preview').hidden) throw Error('Missing lesson preview');
  document.getElementById('lesson-preview').click();
  await document.getElementById('dialog-image').decode();
  return 'All four features and five original screenshots passed';
})()
JS
agent-browser --session "$session" press Escape
agent-browser --session "$session" eval --stdin <<'JS'
(async () => {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (document.getElementById('image-dialog').open || document.activeElement.id !== 'lesson-preview') throw Error('Escape/focus restore');
  return 'Escape close and focus restore passed';
})()
JS
