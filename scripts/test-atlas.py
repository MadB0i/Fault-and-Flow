"""Native Python Playwright checks, invoked by the npm Playwright runner."""
import argparse
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:5173")
parser.add_argument("--browser")
parser.add_argument("--shots", action="store_true")
args = parser.parse_args()
OUT = ROOT / "docs/screenshots" if args.shots else ROOT / ".cache/qa"
OUT.mkdir(parents=True, exist_ok=True)
checks = []


def record(label):
    checks.append(label)
    print("PASS:", label, flush=True)


def ready(page):
    expect(page.get_by_test_id("scenario-play")).to_be_enabled(timeout=30000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(700)


def scan(page, label):
    overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
    assert not overflow, label + ": horizontal overflow"
    page.add_script_tag(path=str(ROOT / "node_modules/axe-core/axe.min.js"))
    results = page.evaluate("""async () => (await axe.run(document, {
        runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}
    })).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))""")
    assert not results, label + ": " + json.dumps(results)
    record(label + " layout and axe")


with sync_playwright() as p:
    launch = {"headless": True, "args": ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]}
    if args.browser:
        launch["executable_path"] = args.browser
    browser = p.chromium.launch(**launch)
    for name, width, height in [("desktop",1440,900),("mobile",390,844)]:
        context = browser.new_context(viewport={"width":width,"height":height},
                                      reduced_motion="reduce", locale="en-IN")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(args.url)
        page.wait_for_load_state("networkidle")
        ready(page)
        expect(page.get_by_role("heading",level=1)).to_have_count(1)
        expect(page.get_by_role("main")).to_have_count(1)
        for mode in ["flow","fault","plates"]:
            page.get_by_test_id("mode-"+mode).click()
            page.wait_for_timeout(800)
            scan(page, name+" "+mode)
            page.screenshot(path=str(OUT/(mode+"-"+name+"-en.png")),
                            animations="disabled", caret="hide", full_page=True)
            page.get_by_role("radio",name="অসমীয়া").check()
            page.wait_for_timeout(600)
            scan(page, name+" "+mode+" Assamese")
            page.screenshot(path=str(OUT/(mode+"-"+name+"-as.png")),
                            animations="disabled", caret="hide", full_page=True)
            page.get_by_role("radio",name="ইংৰাজী").check()
        if args.shots:
            assert not errors, errors
            context.close()
            continue
        # Collision respects reduced motion and reaches its final illustrative state.
        page.get_by_role("button",name="Play collision",exact=True).click()
        expect(page.locator("#collision")).to_have_value("1")
        record(name+" reduced motion collision")
        page.get_by_role("button",name="Down to the river",exact=True).click()
        ready(page)
        # Browser history restores the mode as well as the view.
        page.get_by_test_id("mode-fault").click()
        page.go_back()
        expect(page.get_by_test_id("app")).to_have_attribute("data-mode","flow")
        record(name+" mode URL history")
        # Full actual terrain scene responds to keyboard controls.
        canvas=page.get_by_test_id("terrain-canvas")
        before=canvas.screenshot()
        canvas.focus();canvas.press("ArrowRight");page.wait_for_timeout(700)
        assert before!=canvas.screenshot(), "keyboard orbit did not change paint"
        canvas.press("Home")
        record(name+" keyboard camera paints")
        page.get_by_test_id("region-majuli").click()
        ready(page)
        page.get_by_test_id("scenario-play").click()
        expect(page.get_by_role("button",name="Pause scenario",exact=True)).to_be_visible()
        expect(page.get_by_test_id("scenario-wet")).not_to_contain_text("—")
        page.wait_for_timeout(1200)
        page.get_by_test_id("scenario-play").click()
        assert "could not continue" not in page.locator(".simulation-message").inner_text()
        page.get_by_role("button",name="Reset scenario",exact=True).click()
        # Layer switches must not rebuild/reset a paused simulation.
        snapshot=page.get_by_test_id("scenario-wet").inner_text()
        if name=="mobile":
            page.get_by_role("button",name="Explore & layers",exact=True).click()
        page.get_by_role("checkbox",name="River network",exact=True).uncheck()
        page.get_by_role("checkbox",name="River network",exact=True).check()
        if name=="mobile":
            page.get_by_role("button",name="Close",exact=True).click()
        assert snapshot==page.get_by_test_id("scenario-wet").inner_text()
        record(name+" flood run pause reset and stable layer controls")
        page.screenshot(path=str(OUT/("majuli-water-"+name+".png")),full_page=True)
        page.get_by_role("button",name="Floods in the record",exact=True).click()
        dialog=page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        expect(dialog).to_contain_text("Historical flood footprints are not bundled")
        for year in ["2007","2008","2020"]:
            dialog.get_by_role("button",name=year,exact=True).click()
            assert "science.nasa.gov" in dialog.get_by_role("link",name="Read the satellite report").get_attribute("href")
        page.keyboard.press("Escape")
        expect(dialog).not_to_be_visible()
        expect(page.get_by_role("button",name="Floods in the record",exact=True)).to_be_focused()
        record(name+" historical sources and dialog focus return")
        page.get_by_role("button",name="Risk & official information",exact=True).click()
        expect(dialog).to_contain_text("No active alert has been verified")
        assert dialog.get_by_role("link").count()==3
        scan(page,name+" risk dialog")
        page.keyboard.press("Escape")
        page.get_by_role("button",name="Sources & limitations",exact=True).click()
        expect(page.get_by_test_id("attribution-text")).to_contain_text("produced using Copernicus WorldDEM-30")
        scan(page,name+" sources dialog")
        page.keyboard.press("Escape")
        with page.expect_download() as downloaded:
            page.get_by_role("button",name="Save map image",exact=True).click()
        target=OUT/("export-"+name+".png")
        downloaded.value.save_as(str(target))
        assert target.stat().st_size>10000
        record(name+" attributed image export")
        page.get_by_test_id("mode-fault").click()
        page.get_by_role("button",name="Explore the 1950 earthquake",exact=True).click()
        expect(page.locator("#quake-year")).to_have_value("1950")
        expect(page.locator(".quake-magnitude")).to_contain_text("8.6")
        assert "earthquake.usgs.gov" in page.get_by_role("link",name="View catalogue record").get_attribute("href")
        page.locator("#quake-year").fill("1900")
        expect(page.locator("#quake-record")).to_contain_text("No catalogue events")
        page.get_by_role("button",name="Play history",exact=True).click()
        page.wait_for_timeout(700)
        page.get_by_role("button",name="Pause history",exact=True).click()
        assert int(page.locator("#quake-year").input_value())>1900
        page.get_by_role("button",name="Illustrate ground motion",exact=True).click()
        expect(page.locator(".motion-note")).to_contain_text("synthetic")
        record(name+" earthquake records, empty state and replay")
        assert not errors, errors
        context.close()
    if not args.shots:
        # Compare the GPU update to its independent headless CPU mirror. Edge
        # clamping used to manufacture water, even while every HUD check passed.
        page=browser.new_page()
        page.goto(args.url);page.wait_for_load_state("networkidle")
        result=page.evaluate(r"""async () => {
            const src=await(await fetch('/src/engine/water/water-layer.ts')).text();
            const threeUrl=src.match(/import \* as THREE from [\"']([^\"']+)/)[1];
            const THREE=await import(threeUrl);
            const {createWaterLayer}=await import('/src/engine/water/water-layer.ts');
            const {createWaterGrid,stepWater,stableDt,totalVolumeM3}=await import('/src/engine/water/step.ts');
            const renderer=new THREE.WebGLRenderer({canvas:document.createElement('canvas')});
            renderer.setSize(8,8);const scene=new THREE.Scene();let depths=[];
            const read=renderer.readRenderTargetPixels.bind(renderer);
            renderer.readRenderTargetPixels=(...args)=>{const r=read(...args);depths=Array.from({length:64},(_,i)=>args[5][i*4+1]);return r;};
            const sim={width:8,height:8,dxM:10,dyM:10,heights:new Float32Array(64),noData:new Uint8Array(64)};
            const layer=createWaterLayer({renderer,scene,sim,channel:{inflow:39,outlet:32,path:[39,38,37,36,35,34,33,32]},extentWM:80,extentHM:80,exaggeration:1,shallowColor:'#7fe3ef',deepColor:'#0e5a73',shorelineColor:'#bff2f8'});
            if(!layer)throw new Error('float targets unavailable');
            layer.setSpeed(1);layer.setDischargeM3s(100);layer.setPlaying(true);
            for(let i=0;i<21;i++)layer.stepFrame(.2);
            const stats=layer.getStats();const dt=stableDt(10,10,30);
            const cpu=createWaterGrid(8,8,10,10,new Float32Array(64),new Uint8Array(64));
            for(let i=0;i<Math.round(stats.simTimeS/dt);i++)stepWater(cpu,dt,[{cell:39,rateM3s:100}]);
            const result={stats,gpuVolume:depths.reduce((a,b)=>a+b,0)*100,cpuVolume:totalVolumeM3(cpu),inputVolume:stats.simTimeS*100};
            layer.reset();result.resetMax=layer.getStats().maxDepthM;
            layer.dispose();renderer.dispose();return result;
        }""")
        assert abs(result["gpuVolume"]-result["cpuVolume"])<.01,result
        assert result["gpuVolume"]<=result["inputVolume"]+.01,result
        assert result["resetMax"]==0,result
        (OUT/"gpu-regression.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
        record("GPU/CPU conservation and numerical reset")
        # A failed DEM request preserves a recoverable, named error state.
        page=browser.new_page()
        page.route("**/*assam-overview.png*",lambda r:r.abort() if r.request.resource_type in ["fetch","xhr","image"] else r.continue_())
        page.goto(args.url)
        expect(page.get_by_test_id("terrain-error")).to_be_visible(timeout=15000)
        page.unroute("**/*assam-overview.png*")
        page.get_by_test_id("terrain-retry").click()
        ready(page)
        record("failed terrain load and retry")
    browser.close()
(OUT/"checks.json").write_text(json.dumps(checks,indent=2),encoding="utf-8")
print(str(len(checks))+" browser checks passed",flush=True)
