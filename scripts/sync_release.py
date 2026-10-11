#!/usr/bin/env python3
"""Mirror stable BITStudy APKs; publish metadata only after verified downloads."""
import argparse
import fcntl
import hashlib
import json
import logging
import os
from pathlib import Path
import shutil
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

REPOSITORY = 'GaryNasser/Android-Correction-Notebook'
API_URL = f'https://api.github.com/repos/{REPOSITORY}/releases/latest'
DOWNLOAD_PREFIX = f'https://github.com/{REPOSITORY}/releases/download/'
HEADERS = {'User-Agent': 'BITStudy-website-release-mirror', 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}


def atomic_json(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.chmod(0o644)
    temporary.replace(path)


def get_release(etag=None):
    headers = dict(HEADERS)
    if etag:
        headers['If-None-Match'] = etag
    token = os.environ.get('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = f'Bearer {token}'
    try:
        with urlopen(Request(API_URL, headers=headers), timeout=30) as response:
            return json.load(response), response.headers.get('ETag')
    except HTTPError as error:
        if error.code == 304:
            return None, etag
        raise


def valid_asset(asset):
    name = asset.get('name', '')
    if not isinstance(name, str) or not name.lower().endswith('.apk'):
        return False
    if name in ('.', '..') or any(ord(c) < 32 or c in '/\\' for c in name):
        raise ValueError('Unsafe APK filename')
    if not isinstance(asset.get('id'), int) or asset['id'] <= 0:
        raise ValueError('Invalid asset ID')
    if not isinstance(asset.get('size'), int) or not 0 < asset['size'] <= 1024 ** 3:
        raise ValueError('Invalid APK size (maximum 1 GiB per file)')
    if not asset.get('browser_download_url', '').startswith(DOWNLOAD_PREFIX):
        raise ValueError('APK URL is outside the official repository')
    return True


def download_asset(asset, directory):
    filename = f"{asset['id']}-{asset['name']}"
    target = directory / filename
    digest = asset.get('digest') or ''
    if digest and (not digest.startswith('sha256:') or len(digest) != 71):
        raise ValueError('Unsupported upstream digest')
    if target.exists() and target.stat().st_size == asset['size']:
        with target.open('rb') as installed:
            existing = hashlib.file_digest(installed, 'sha256').hexdigest()
        if digest == f'sha256:{existing}':
            return target, existing
    temporary = target.with_suffix('.tmp')
    try:
        checksum = hashlib.sha256()
        total = 0
        request = Request(asset['browser_download_url'], headers={'User-Agent': HEADERS['User-Agent']})
        with urlopen(request, timeout=120) as response, temporary.open('wb') as output:
            if urlparse(response.geturl()).hostname not in {'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com'}:
                raise ValueError('Unexpected download host')
            first_chunk = True
            while chunk := response.read(1024 * 1024):
                if first_chunk and not chunk.startswith(b'PK\x03\x04'):
                    raise ValueError('Downloaded file is not an APK/ZIP')
                first_chunk = False
                total += len(chunk)
                if total > asset['size']:
                    raise ValueError('APK exceeds published size')
                output.write(chunk)
                checksum.update(chunk)
            output.flush()
            os.fsync(output.fileno())
        actual = checksum.hexdigest()
        if total != asset['size'] or (digest and digest != f'sha256:{actual}'):
            raise ValueError('APK size or SHA-256 does not match GitHub')
        temporary.chmod(0o644)
        temporary.replace(target)
        logging.info('Mirrored %s (%s bytes)', asset['name'], total)
        return target, actual
    finally:
        temporary.unlink(missing_ok=True)


def cached_files_available(root, metadata):
    return bool(metadata.get('assets')) and all(
        (root / 'downloads' / str(metadata['release_id']) / f"{asset['id']}-{asset['filename']}").is_file()
        and (root / 'downloads' / str(metadata['release_id']) / f"{asset['id']}-{asset['filename']}").stat().st_size == asset['size']
        for asset in metadata['assets']
    ) and (root / 'latest.apk').is_file()


def sync(root):
    metadata_path = root / 'release.json'
    state_path = root / 'state.json'
    previous = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    available = cached_files_available(root, previous)
    release, etag = get_release(state.get('etag') if available else None)
    if release is None:
        logging.info('Latest release unchanged; cached APKs available')
        return False
    if release.get('draft') or release.get('prerelease'):
        raise ValueError('Only published stable releases are mirrored')
    if not isinstance(release.get('id'), int) or release['id'] <= 0 or not isinstance(release.get('tag_name'), str):
        raise ValueError('Invalid release metadata')
    assets = [asset for asset in release.get('assets', []) if valid_asset(asset)]
    if not assets:
        raise ValueError('Latest stable release has no APK; keeping previous download')
    assets.sort(key=lambda a: ('universal' not in a['name'].lower(), not a['name'].lower().startswith('bitstudy'), a['name']))
    release_dir = root / 'downloads' / str(release['id'])
    release_dir.mkdir(parents=True, exist_ok=True)
    mirrored = []
    for asset in assets:
        target, checksum = download_asset(asset, release_dir)
        mirrored.append({'id': asset['id'], 'filename': asset['name'], 'size': asset['size'], 'sha256': checksum, 'download_url': f"/downloads/{release['id']}/{quote(target.name, safe='')}"})
    metadata = {
        'release_id': release['id'], 'tag': release['tag_name'], 'published_at': release.get('published_at'),
        'release_url': release.get('html_url'), 'notes': release.get('body') or '',
        'synced_at': datetime.now(timezone.utc).isoformat(), 'assets': mirrored,
        **{key: value for key, value in mirrored[0].items() if key != 'id'},
    }
    latest_temporary = root / 'latest.tmp'
    latest_temporary.unlink(missing_ok=True)
    latest_temporary.symlink_to(Path('downloads') / str(release['id']) / f"{mirrored[0]['id']}-{mirrored[0]['filename']}")
    latest_temporary.replace(root / 'latest.apk')
    atomic_json(metadata_path, metadata)
    atomic_json(state_path, {'etag': etag})
    # Keep current + two previous release directories; never remove the active release.
    old_dirs = sorted((p for p in (root / 'downloads').iterdir() if p.is_dir() and p.name.isdigit() and p != release_dir), key=lambda p: p.stat().st_mtime, reverse=True)
    for directory in old_dirs[2:]:
        shutil.rmtree(directory)
    logging.info('Published %s with %s APK(s)', metadata['tag'], len(mirrored))
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/var/lib/bitstudy'))
    arguments = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    arguments.root.mkdir(parents=True, exist_ok=True)
    with (arguments.root / 'sync.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            logging.info('Another sync is running')
            return
        sync(arguments.root)


if __name__ == '__main__':
    main()
