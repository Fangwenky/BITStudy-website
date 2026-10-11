'use strict';
const demoCourses = [
  [['高等数学', '08:00', '09:35', '∑'], ['大学物理', '10:00', '11:35', 'λ']],
  [['程序设计', '08:00', '09:35', '{ }'], ['大学英语', '14:00', '15:35', 'Aa']],
  [['线性代数', '10:00', '11:35', '∑'], ['大学物理', '14:00', '15:35', 'λ']],
  [['高等数学', '08:00', '09:35', '∑'], ['程序设计', '10:00', '11:35', '{ }']],
  [['大学英语', '10:00', '11:35', 'Aa'], ['线性代数', '14:00', '15:35', '∑']]
];
document.querySelectorAll('[data-day]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-day]').forEach(day => day.setAttribute('aria-pressed', String(day === button)));
  const fragment = document.createDocumentFragment();
  demoCourses[Number(button.dataset.day)].forEach(([name, start, end, symbol], index) => {
    const card = document.createElement('div');
    card.className = `course course-${index === 0 ? 'blue' : 'mint'}`;
    const time = document.createElement('time');
    time.append(start, document.createElement('br'));
    const endTime = document.createElement('span');
    endTime.textContent = end;
    time.append(endTime);
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = name;
    const location = document.createElement('p');
    location.textContent = '良乡校区 · 示例教室';
    copy.append(title, location);
    const mark = document.createElement('span');
    mark.className = 'course-symbol';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = symbol;
    card.append(time, copy, mark);
    fragment.append(card);
  });
  document.getElementById('demo-courses').replaceChildren(fragment);
}));

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
