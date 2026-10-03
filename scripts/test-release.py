"""Native Python Playwright regression checks for the final exploration pass."""
import argparse
import base64
import io
from pathlib import Path
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:5173')
parser.add_argument('--browser')
args = parser.parse_args()
OUT = ROOT / '.cache/qa'
OUT.mkdir(parents=True, exist_ok=True)
checks = []

def passed(label):
    checks.append(label)
    print('PASS:', label, flush=True)

def scan(page, label):
    page.add_script_tag(path=str(ROOT / 'node_modules/axe-core/axe.min.js'))
    violations = page.evaluate("""async () => (await axe.run(document, {
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}
    })).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))""")
    assert not violations, (label, violations)
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), label
    passed(label)

with sync_playwright() as p:
    launch = dict(headless=True, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    if args.browser: launch['executable_path'] = args.browser
    browser = p.chromium.launch(**launch)
    for width in [1440, 390]:
        context = browser.new_context(viewport=dict(width=width,height=900 if width==1440 else 844),
                                      reduced_motion='reduce',device_scale_factor=2 if width==1440 else 1,
                                      accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(args.url+'/?area=majuli&level=8')
        expect(page.get_by_test_id('scenario-play')).to_be_enabled(timeout=30000)
        page.get_by_test_id('scenario-play').click()
        page.wait_for_timeout(1200)
        page.get_by_test_id('scenario-play').click()
        page.wait_for_timeout(500)
        canvas = page.get_by_test_id('terrain-canvas')
        wet = Image.open(io.BytesIO(canvas.screenshot())).convert('RGB')
        page.get_by_label('Compare dry terrain / scenario',exact=True).check()
        page.wait_for_timeout(500)
        split = Image.open(io.BytesIO(canvas.screenshot())).convert('RGB')
        # Exclude the 44 CSS pixel split handle and hairline. Both passes must use exactly the same camera.
        w,h = wet.size
        assert ImageChops.difference(wet.crop((0,0,w//2-64,h)),split.crop((0,0,w//2-64,h))).getbbox()
        assert not ImageChops.difference(wet.crop((w//2+64,0,w,h)),split.crop((w//2+64,0,w,h))).getbbox()
        slider = page.get_by_role('slider',name='Comparison split',exact=True)
        bounds=canvas.bounding_box()
        page.mouse.move(bounds['x']+bounds['width']*.5,bounds['y']+bounds['height']*.5)
        page.mouse.down()
        page.mouse.move(bounds['x']+bounds['width']*.7,bounds['y']+bounds['height']*.5,steps=6)
        page.mouse.up()
        assert int(slider.input_value()) > 60, 'Map divider did not drag'
        slider.focus(); slider.press('Home')
        expect(slider).to_have_value('5')
        divider = page.get_by_role('slider',name='Drag the map divider',exact=True)
        divider.focus(); divider.press('End')
        expect(slider).to_have_value('95')
        divider.press('Home')
        expect(slider).to_have_value('5')
        page.screenshot(path=str(OUT/f'comparison-{width}.png'),full_page=True)
        scan(page,f'{width} same-camera comparison and keyboard split')
        if width==1440:
            full = page.evaluate('document.querySelector("canvas").width')
            page.get_by_role('button',name='Explore & layers',exact=True).click()
            page.get_by_label('Display quality',exact=True).select_option('lite')
            page.wait_for_timeout(500)
            lite = page.evaluate('document.querySelector("canvas").width')
            assert lite < full, (lite,full)
            page.get_by_label('Display quality',exact=True).select_option('full')
            page.get_by_role('button',name='Close',exact=True).click()
            passed('Lite changes only pixel resolution')
        page.get_by_test_id('mode-fault').click()
        page.get_by_role('button',name='Explore more',exact=True).click()
        count = page.locator('#quake-record option').count()
        page.get_by_label('Show recorded magnitudes',exact=True).select_option('7')
        assert page.locator('#quake-record option').count() < count
        page.get_by_role('button',name='Collapse',exact=True).click()
        page.wait_for_timeout(700)
        # Locate a red sphere from actual pixels; no debug scene/API is exposed.
        image = Image.open(io.BytesIO(canvas.screenshot(scale='css'))).convert('RGB')
        target = None
        for y in range(110,image.height-110):
            for x in range(100,image.width-90):
                r,g,b = image.getpixel((x,y))
                if r>160 and r>g*1.7 and b>g*1.1 and b<r*.8:
                    target=(x,y);break
            if target:break
        assert target, 'No visible red epicentre found'
        box = canvas.bounding_box()
        page.mouse.dblclick(box['x']+target[0],box['y']+target[1])
        page.wait_for_timeout(400)
        expect(page.locator('dialog')).not_to_be_visible()
        canvas.focus(); canvas.press('Home'); page.wait_for_timeout(400)
        page.mouse.click(box['x']+target[0],box['y']+target[1])
        expect(page.locator('.event-detail')).to_be_visible(timeout=5000)
        scan(page,f'{width} map-picked source record')
        metrics=page.evaluate('''() => {
          const e=document.querySelector('.event-detail .event-magnitude'),s=getComputedStyle(e);
          return {fontSize:s.fontSize,fontFamily:s.fontFamily,color:s.color,
            radius:getComputedStyle(document.querySelector('dialog')).borderRadius};
        }''')
        (OUT/f'interface-metrics-{width}.json').write_text(__import__('json').dumps(metrics,indent=2))
        page.screenshot(path=str(OUT/f'event-{width}.png'),full_page=True)
        page.get_by_role('button',name='Focus this epicentre',exact=True).click()
        expect(page.locator('dialog')).not_to_be_visible()
        page.get_by_role('button',name='Find your district',exact=True).click()
        page.get_by_label('Search districts',exact=True).fill('Dibrugarh')
        page.locator('.district-grid button').click()
        page.get_by_role('button',name='Explore this place',exact=True).click()
        expect(page.locator('.nearby-records button')).to_have_count(5)
        scan(page,f'{width} district source context')
        page.screenshot(path=str(OUT/f'district-story-{width}.png'),full_page=True)
        page.get_by_role('button',name='Close',exact=True).click()
        page.get_by_role('radio',name='অসমীয়া').check()
        page.get_by_role('button',name='এই ঠাই অন্বেষণ কৰক',exact=True).click()
        scan(page,f'{width} Assamese district context')
        page.screenshot(path=str(OUT/f'district-story-{width}-as.png'),full_page=True)
        page.get_by_role('button',name='বন্ধ কৰক',exact=True).click()
        page.get_by_role('radio',name='ইংৰাজী').check()
        page.get_by_role('button',name='Take a short tour',exact=True).click()
        expect(page.locator('.guided-tour')).to_be_visible()
        expect(page.get_by_test_id('scenario-play')).to_have_text('Run scenario')
        page.get_by_role('button',name='Next',exact=True).click()
        page.get_by_role('button',name='Next',exact=True).click()
        expect(page.get_by_test_id('app')).to_have_attribute('data-mode','fault')
        scan(page,f'{width} optional paced tour')
        page.get_by_role('button',name='Explore on your own',exact=True).click()
        assert not errors, errors
        context.close()
    # A real browser WebM download, plus unsupported-browser fallback.
    page = browser.new_page(viewport=dict(width=1440,height=900),accept_downloads=True)
    page.goto(args.url+'/?mode=fault')
    expect(page.get_by_role('button',name='Play history',exact=True)).to_be_enabled(timeout=30000)
    page.get_by_role('button',name='Play history',exact=True).click()
    page.get_by_role('button',name='Share this view',exact=True).click()
    expect(page.get_by_role('button',name='Save portrait story',exact=True)).to_be_enabled(timeout=15000)
    with page.expect_download(timeout=25000) as download:
        page.get_by_role('button',name='Record 8-second portrait video',exact=True).click()
    dest = OUT / 'portrait-test.webm'
    download.value.save_as(dest)
    data = dest.read_bytes()
    assert data[:4]==bytes.fromhex('1a45dfa3') and len(data)>10000
    metadata = page.evaluate("""async b64 => {
      const video=document.createElement('video');
      video.src='data:video/webm;base64,'+b64;
      await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject});
      const width=video.videoWidth,height=video.videoHeight;
      const capture=async time => {
        video.currentTime=time;
        await new Promise(resolve=>{video.onseeked=resolve});
        const canvas=document.createElement('canvas');canvas.width=720;canvas.height=459;
        canvas.getContext('2d').drawImage(video,0,320,720,459,0,0,720,459);
        return canvas.toDataURL('image/png').split(',')[1];
      };
      return [width,height,await capture(.5),await capture(5)];
    }""",base64.b64encode(data).decode())
    assert metadata[:2]==[720,1280],metadata[:2]
    first = Image.open(io.BytesIO(base64.b64decode(metadata[2]))).convert('RGB')
    last = Image.open(io.BytesIO(base64.b64decode(metadata[3]))).convert('RGB')
    assert ImageChops.difference(first,last).getbbox(), 'Video map animation did not change'
    first.save(OUT/'video-first.png'); last.save(OUT/'video-last.png')
    passed('Real silent 9:16 WebM with changing map frames and local download')
    page.get_by_role('button',name='Share this view',exact=True).click()
    expect(page.get_by_role('button',name='Save portrait story',exact=True)).to_be_enabled(timeout=15000)
    page.evaluate('window.MediaRecorder=undefined')
    page.get_by_role('button',name='Record 8-second portrait video',exact=True).click()
    expect(page.get_by_text('Video recording is unavailable in this browser. Save the portrait PNG instead.',exact=True)).to_be_visible()
    passed('Unsupported recording leaves PNG and link sharing available')
    page.evaluate('() => { window.MediaRecorder=class { static isTypeSupported() { return false; } }; }')
    page.get_by_role('button',name='Record 8-second portrait video',exact=True).click()
    expect(page.get_by_text('Video recording is unavailable in this browser. Save the portrait PNG instead.',exact=True)).to_be_visible()
    passed('Unsupported WebM codecs show a usable PNG fallback')
    browser.close()
print(f'{len(checks)} release checks passed',flush=True)
