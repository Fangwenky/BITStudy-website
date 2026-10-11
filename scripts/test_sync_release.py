"""Run: python3 -m unittest discover -s scripts -p 'test_*.py'."""
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sync_release as mirror


class Response(io.BytesIO):
    def geturl(self):
        return 'https://release-assets.githubusercontent.com/test.apk'


class MirrorTest(unittest.TestCase):
    def test_publish_unchanged_failed_update_and_recovery(self):
        apk = b'PK\x03\x04test APK bytes'
        digest = hashlib.sha256(apk).hexdigest()
        asset = {'id': 2, 'name': 'BITStudy-v1.apk', 'size': len(apk), 'digest': f'sha256:{digest}', 'browser_download_url': mirror.DOWNLOAD_PREFIX + 'v1/BITStudy-v1.apk'}
        release = {'id': 1, 'tag_name': 'v1', 'assets': [asset], 'html_url': 'https://github.com/GaryNasser/Android-Correction-Notebook/releases/tag/v1'}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(mirror, 'get_release', return_value=(release, 'etag1')), patch.object(mirror, 'urlopen', side_effect=lambda *a, **k: Response(apk)):
                self.assertTrue(mirror.sync(root))
            original = (root / 'release.json').read_bytes()
            self.assertEqual((root / 'latest.apk').read_bytes(), apk)
            self.assertEqual(json.loads(original)['sha256'], digest)
            with patch.object(mirror, 'get_release', return_value=(release, 'etag1')), patch.object(mirror, 'urlopen') as download:
                self.assertTrue(mirror.sync(root))
                download.assert_not_called()
            original = (root / 'release.json').read_bytes()
            with patch.object(mirror, 'get_release', return_value=(None, 'etag1')) as fetch:
                self.assertFalse(mirror.sync(root))
                fetch.assert_called_once_with('etag1')
            newer = {**release, 'id': 3, 'tag_name': 'v2', 'assets': [{**asset, 'id': 4}]}
            with patch.object(mirror, 'get_release', return_value=(newer, 'etag2')), patch.object(mirror, 'urlopen', side_effect=lambda *a, **k: Response(b'PK\x03\x04corrupt APK')):
                with self.assertRaises(ValueError):
                    mirror.sync(root)
            self.assertEqual((root / 'release.json').read_bytes(), original)
            self.assertEqual((root / 'latest.apk').read_bytes(), apk)
            self.assertEqual(json.loads((root / 'state.json').read_text())['etag'], 'etag1')
            self.assertFalse(list(root.rglob('*.tmp')))
            (root / 'latest.apk').resolve().unlink()
            with patch.object(mirror, 'get_release', return_value=(release, 'etag1')) as fetch, patch.object(mirror, 'urlopen', side_effect=lambda *a, **k: Response(apk)):
                self.assertTrue(mirror.sync(root))
                fetch.assert_called_once_with(None)
            self.assertEqual((root / 'latest.apk').read_bytes(), apk)

    def test_reject_untrusted_asset_and_html(self):
        asset = {'id': 2, 'name': '../evil.apk', 'size': 7, 'browser_download_url': mirror.DOWNLOAD_PREFIX + 'v1/a.apk'}
        with self.assertRaises(ValueError):
            mirror.valid_asset(asset)
        with self.assertRaises(ValueError):
            mirror.valid_asset({**asset, 'name': 'app.apk', 'browser_download_url': 'https://example.com/app.apk'})
        with tempfile.TemporaryDirectory() as directory, patch.object(mirror, 'urlopen', side_effect=lambda *a, **k: Response(b'<html/>')):
            with self.assertRaises(ValueError):
                mirror.download_asset({**asset, 'name': 'app.apk'}, Path(directory))


if __name__ == '__main__':
    unittest.main()
