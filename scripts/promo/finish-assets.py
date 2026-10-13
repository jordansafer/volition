"""Export a continuous excerpt of real footage, validate assets and bundle uploads."""
from pathlib import Path
import argparse, json, shutil, subprocess
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--ffmpeg', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
out = root / 'docs/promo'
run = lambda *items: subprocess.run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', *map(str, items)], check=True)
# Only the leading Settings setup is removed. Every remaining frame is live browser footage.
run('-ss', '12', '-i', out/'volition-live-demo.mp4', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out/'volition-promo.mp4')
# The thumbnail is an actual recorded frame during the live request, without overlays.
run('-ss', '23', '-i', out/'volition-live-demo.mp4', '-frames:v', '1', out/'video-thumbnail-1920x1080.png')
run('-i', out/'volition-promo.mp4', '-f', 'null', '-')
expected = {'01-blocked.png': (1280,800), '02-request.png': (1280,800), '03-settings.png': (1280,800), '04-statistics.png': (1280,800), 'store-tile-440x280.png': (440,280), 'marquee-1400x560.png': (1400,560), 'video-thumbnail-1920x1080.png': (1920,1080)}
for name, size in expected.items():
    with Image.open(out/name) as im:
        assert im.size == size and im.mode == 'RGB', (name, im.size, im.mode)
log = json.loads((out/'recording-log.json').read_text())
assert log['complete'] and any('expired' in entry['action'] for entry in log['events'])
shutil.copy2(out/'volition-promo.mp4', root/'docs/volition_demo.mp4')
shutil.copy2(out/'01-blocked.png', root/'docs/screenshot-blocked.png')
shutil.copy2(out/'03-settings.png', root/'docs/screenshot-settings.png')
shutil.copy2(out/'timed-access-live-1920x1080.png', root/'docs/screenshot-countdown.png')
with ZipFile(root/'docs/volition-store-assets.zip', 'w', ZIP_DEFLATED) as archive:
    for name in [*expected, 'volition-promo.mp4', 'recording-log.json', 'README.md']:
        archive.write(out/name, name)
print('Live footage exported and decoded; RGB image dimensions verified; canonical assets and upload ZIP updated.')
