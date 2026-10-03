"""Capture the real app and encode a small attributed GIF; no synthetic data frames."""
import argparse
import io
import json
import re
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:5173')
parser.add_argument('--browser')
args = parser.parse_args()
OUT = ROOT / 'docs/media'
OUT.mkdir(parents=True,exist_ok=True)
credit = json.loads((ROOT / 'data/processed/assam-overview.json').read_text())['attribution']
frames = []

def frame(page, duration=220):
    page.wait_for_timeout(duration)
    image = Image.open(io.BytesIO(page.screenshot())).convert('RGB')
    frames.append(image.resize((960,600),Image.Resampling.LANCZOS))
    cache=ROOT/'.cache/qa/release-frames'
    cache.mkdir(parents=True,exist_ok=True)
    frames[-1].save(cache/f'frame-{len(frames)-1}.png')

with sync_playwright() as p:
    launch=dict(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    if args.browser: launch['executable_path']=args.browser
    browser=p.chromium.launch(**launch)
    page=browser.new_page(viewport=dict(width=1280,height=800))
    page.set_default_timeout(60000)
    page.goto(args.url+'/?area=majuli&level=6')
    expect(page.get_by_test_id('scenario-play')).to_be_enabled(timeout=30000)
    page.evaluate('document.fonts.ready')
    page.evaluate("""credit => {
      const caption=document.createElement('div');
      caption.textContent='Educational sandbox · chosen flood scenario / illustrative shaking. '+credit+
        ' · Natural Earth · © OpenStreetMap contributors (ODbL) · Earthquake catalogue: USGS.';
      Object.assign(caption.style,{position:'fixed',bottom:'0',left:'0',right:'0',zIndex:'20',
        padding:'8px 24px',background:'var(--bg)',color:'var(--text-muted)',
        fontFamily:'var(--font-ui)',fontSize:'11px',lineHeight:'1.5',pointerEvents:'none'});
      document.body.append(caption);
    }""",credit)
    for _ in range(3):frame(page)
    page.get_by_test_id('scenario-play').click()
    page.wait_for_timeout(900)
    page.get_by_label('Compare dry terrain / scenario',exact=True).check()
    slider=page.get_by_role('slider',name='Comparison split',exact=True)
    slider.focus()
    for _ in range(12):
        slider.press('ArrowLeft');slider.press('ArrowLeft')
        frame(page)
    page.get_by_test_id('scenario-play').click()
    page.screenshot(path=str(OUT/'flood-comparison.png'))
    page.get_by_test_id('mode-fault').click()
    expect(page.get_by_role('button',name='Share this view',exact=True)).to_be_enabled(timeout=60000)
    page.wait_for_timeout(900)
    page.get_by_role('button',name='Explore more',exact=True).click()
    page.get_by_role('button',name='Explore the 1950 earthquake',exact=True).click()
    expect(page.get_by_role('button',name='Illustrate ground motion',exact=True)).to_be_enabled(timeout=60000)
    page.get_by_role('button',name='Illustrate ground motion',exact=True).click(no_wait_after=True)
    page.get_by_role('button',name='Collapse',exact=True).click()
    for _ in range(16):frame(page,180)
    page.get_by_role('button',name='Explore more',exact=True).click()
    page.get_by_label('Show recorded magnitudes',exact=True).select_option('7')
    page.get_by_role('button',name='Collapse',exact=True).click()
    for _ in range(3):frame(page)
    page.screenshot(path=str(OUT/'earthquake-history.png'))
    browser.close()
# A single palette across frames avoids colour shimmer and reduces file size.
sheet=Image.new('RGB',(960,600*len(frames)))
for i,image in enumerate(frames):sheet.paste(image,(0,i*600))
palette=sheet.resize((480,300*len(frames))).quantize(colors=240)
# Reserve rare semantic accents so magnitude bands survive the GIF palette.
tokens=(ROOT/'src/ui/styles/tokens.css').read_text()
colors=palette.getpalette()
for i,name in enumerate(['water','water-deep','water-shallow','water-shoreline',
                         'seismic-amber','seismic-light','seismic-red','text','bg','surface']):
    value=re.search(r'--'+name+r':\s*#([0-9a-f]{6})',tokens).group(1)
    colors[(240+i)*3:(241+i)*3]=[int(value[j:j+2],16) for j in [0,2,4]]
palette.putpalette(colors)
encoded=[image.quantize(palette=palette,dither=Image.Dither.NONE) for image in frames]
path=OUT/'atlas-demo.gif'
encoded[0].save(path,save_all=True,append_images=encoded[1:],duration=220,loop=0,optimize=True)
assert path.stat().st_size < 5*1024*1024, 'GIF exceeds the repository limit'
print(f'{len(frames)} actual browser frames; {path.stat().st_size:,} bytes: {path}',flush=True)
