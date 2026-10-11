'use strict';
const screens = {
  schedule: {
    label: '课程表',
    kicker: '把一周铺开来看',
    title: '下一节课，心里有数。',
    copy: '课程、节次和教室，整理进清晰的周课表。上课前看一眼，就知道什么时候出发、去哪里上课。',
    note: '按周查看课程，随时切换日期。',
    caption: '课程、时间、教室，都在一张表里。',
    alt: 'BITStudy 周课表，展示课程、教室和上课时间'
  },
  ddl: {
    label: '作业与 DDL',
    kicker: '作业和考试，一起理清',
    title: '还要交什么，不用来回找。',
    copy: '从 BIT 学习平台同步作业与考试，把截止时间和提交状态列在一起。全部、待完成、已提交，按需筛选。',
    note: '当前不包含乐学或教师线下布置的任务。',
    caption: '截止时间与提交状态，放在一起确认。',
    alt: 'BITStudy DDL 列表，显示作业、考试的截止时间与提交状态'
  },
  yanhe: {
    label: '延河课堂',
    kicker: '把课堂带到身边',
    title: '没听懂的那一段，再听一次。',
    copy: '接入北理官方课程录播平台，按课程和节次找录像。选择屏幕录制或摄像头画面，记下笔记，保留继续学习的位置。',
    note: '支持后台播放与通知栏控制。',
    caption: '个人课程按学期整理，也能搜索课程和老师。',
    alt: '延河课堂个人课程界面，显示学期选择、搜索和课程列表'
  },
  bitshare: {
    label: 'BITShare',
    kicker: '北理同学的共享资料库',
    title: '同学分享的资料，直接找到。',
    copy: '直连北理同学自主创建的开源项目 BITShare。在应用里搜索免费学习资料、浏览目录、查看文件并下载，复习时少找一会儿。',
    note: '资料由 BITShare 社区提供，免费搜索与下载。',
    caption: '搜索公开资源，浏览目录，下载需要的资料。',
    alt: 'BITShare 搜索界面，展示 Python 公开资料目录与排序筛选'
  },
  lessons: {
    label: '课程节次与笔记',
    alt: '延河课堂课程节次界面，显示学习进度、笔记入口和两种录像选择'
  }
};

let activeFeature = 'schedule';
const screenshot = document.getElementById('screenshot-image');
const dialog = document.getElementById('image-dialog');
let zoomTrigger;

document.querySelectorAll('[data-feature]').forEach(button => {
  button.addEventListener('click', () => {
    activeFeature = button.dataset.feature;
    const screen = screens[activeFeature];
    document.querySelectorAll('[data-feature]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    for (const [id, value] of Object.entries({
      'feature-kicker': screen.kicker, 'feature-title': screen.title,
      'feature-copy': screen.copy, 'feature-note': screen.note,
      'screen-label': screen.label, 'screen-caption': screen.caption
    })) document.getElementById(id).textContent = value;
    screenshot.src = `/assets/screenshots/${activeFeature}.png`;
    screenshot.alt = screen.alt;
    document.getElementById('screen-image-button').setAttribute('aria-label', `放大查看${screen.label}完整截图`);
    document.getElementById('lesson-preview').hidden = activeFeature !== 'yanhe';
  });
});

function openScreenshot(key, trigger) {
  const source = `/assets/screenshots/${key}.png`;
  zoomTrigger = trigger;
  document.getElementById('image-dialog-title').textContent = screens[key].label;
  document.getElementById('dialog-image').src = source;
  document.getElementById('dialog-image').alt = screens[key].alt;
  document.getElementById('dialog-original').href = source;
  dialog.showModal();
  document.body.classList.add('modal-open');
  document.querySelector('.dialog-scroll').scrollTop = 0;
  document.getElementById('dialog-close').focus();
}

document.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => openScreenshot(button.dataset.zoom, button)));
for (const id of ['screen-zoom', 'screen-image-button']) {
  const button = document.getElementById(id);
  button.addEventListener('click', () => openScreenshot(activeFeature, button));
}
document.getElementById('dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  zoomTrigger?.focus({preventScroll: true});
});

async function loadRelease() {
  try {
    const response = await fetch('/api/release.json', {cache: 'no-store', signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error('Release unavailable');
    const release = await response.json();
    if (typeof release.tag !== 'string' || typeof release.download_url !== 'string' || !/^\/downloads\/[0-9]+\/[0-9]+-[^/]+\.apk$/i.test(release.download_url) || !Number.isFinite(release.size) || release.size <= 0) throw new Error('Invalid release');
    const date = new Date(release.published_at);
    document.getElementById('release-version').textContent = `BITStudy ${release.tag}`;
    document.getElementById('release-date').textContent = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'}).format(date);
    const size = `${(release.size / 1024 / 1024).toFixed(1)} MB`;
    document.getElementById('release-meta').textContent = `${size} · Android 7.0+ · 官网直连下载`;
    document.getElementById('hero-version').textContent = `${release.tag} · ${size} · Android 7.0+`;
    document.querySelectorAll('[data-download]').forEach(link => {link.href = release.download_url; link.setAttribute('download', release.filename);});
    const notes = typeof release.notes === 'string' ? release.notes : '';
    const updateSection = notes.split(/##\s*更新内容\s*/)[1]?.split(/\n##\s/)[0] || notes;
    const highlights = updateSection.split('\n').filter(line => /^\s*[-*]\s+/.test(line)).slice(0, 3);
    if (highlights.length) document.getElementById('release-highlights').replaceChildren(...highlights.map(line => {
      const item = document.createElement('li');
      item.textContent = line.replace(/^\s*[-*]\s+/, '').replace(/`/g, '');
      return item;
    }));
    document.getElementById('release-notes').textContent = notes;
    document.getElementById('release-details').hidden = !notes;
    if (/^[a-f0-9]{64}$/.test(release.sha256 || '')) {
      document.getElementById('release-checksum').textContent = release.sha256;
      document.getElementById('checksum-details').hidden = false;
    }
    const otherAssets = Array.isArray(release.assets) ? release.assets.filter(asset => asset.download_url !== release.download_url && /^\/downloads\/[0-9]+\/[0-9]+-[^/]+\.apk$/i.test(asset.download_url)) : [];
    document.getElementById('asset-details').hidden = otherAssets.length === 0;
    document.getElementById('asset-list').replaceChildren(...otherAssets.map(asset => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = asset.download_url;
      link.textContent = asset.filename;
      link.setAttribute('download', asset.filename);
      item.append(link);
      return item;
    }));
    if (typeof release.release_url === 'string' && release.release_url.startsWith('https://github.com/GaryNasser/Android-Correction-Notebook/releases/')) document.getElementById('release-source').href = release.release_url;
  } catch {
    document.getElementById('release-date').textContent = '版本信息暂不可用';
    document.getElementById('release-meta').textContent = '可尝试直接下载；如遇问题，请查看原始发布记录。';
  }
}
loadRelease();
