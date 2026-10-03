"""Native Python Playwright checks, invoked by the npm Playwright runner."""
import argparse
import json
import os
import struct
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
        play_box = page.get_by_test_id("scenario-play").bounding_box()
        assert play_box["y"] + play_box["height"] <= height, "Primary play action is below the first viewport"
        expect(page.get_by_role("button",name="Explore more",exact=True)).to_have_attribute("aria-expanded","false")
        record(name+" primary action visible without scrolling")
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
            # The portrait is a user-reviewable crop, in both shipping languages.
            page.get_by_test_id("mode-flow").click()
            ready(page)
            page.get_by_role("button",name="Find your district",exact=True).click()
            page.get_by_label("Search districts",exact=True).fill("Dibrugarh")
            page.locator(".district-grid button").click()
            page.wait_for_timeout(500)
            for lang in ["en","as"]:
                if lang=="as": page.get_by_role("radio",name="অসমীয়া").check()
                page.locator(".share-launch").click()
                portrait_button=page.get_by_role("button",name="Save portrait story" if lang=="en" else "উলম্ব ছবি সংৰক্ষণ কৰক",exact=True)
                expect(portrait_button).to_be_enabled(timeout=15000)
                with page.expect_download() as portrait:
                    portrait_button.click()
                story_target=OUT/("portrait-"+name+"-"+lang+".png")
                portrait.value.save_as(str(story_target))
                assert struct.unpack(">II",story_target.read_bytes()[16:24]) == (1080,1920)
                scan(page,name+" portrait "+lang)
                page.screenshot(path=str(OUT/("share-"+name+"-"+lang+".png")),full_page=True)
                page.keyboard.press("Escape")
            page.get_by_role("radio",name="ইংৰাজী").check()
            page.get_by_role("button",name="Explore more",exact=True).click()
            page.get_by_test_id("mode-flow").click()
            ready(page)
            page.get_by_test_id("region-majuli").click()
            ready(page)
            page.get_by_test_id("scenario-play").click()
            page.get_by_test_id("scenario-play").click()
            page.get_by_role("button",name="Reset scenario",exact=True).click()
            page.get_by_role("button",name="Depth bands",exact=True).click()
            page.get_by_role("button",name="River cross-section",exact=True).click()
            expect(page.get_by_test_id("section-depth")).to_contain_text("2.00 m")
            canvas_box=page.get_by_test_id("terrain-canvas").bounding_box()
            tools_box=page.locator(".map-tools").bounding_box()
            assert tools_box["y"] >= canvas_box["y"] and tools_box["y"]+tools_box["height"] <= canvas_box["y"]+canvas_box["height"], "depth tools escaped the map"
            caption_box=page.locator(".map-caption").bounding_box()
            assert not (caption_box["x"] < tools_box["x"]+tools_box["width"] and caption_box["x"]+caption_box["width"] > tools_box["x"] and caption_box["y"] < tools_box["y"]+tools_box["height"] and caption_box["y"]+caption_box["height"] > tools_box["y"]), "depth legend covers map tools"
            scan(page,name+" depth section")
            page.screenshot(path=str(OUT/("depth-section-"+name+"-en.png")),full_page=True)
            page.get_by_role("radio",name="অসমীয়া").check()
            scan(page,name+" depth section Assamese")
            page.screenshot(path=str(OUT/("depth-section-"+name+"-as.png")),full_page=True)
            assert not errors, errors
            context.close()
            continue
        page.get_by_role("button",name="Explore more",exact=True).click()
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
        # Every sourced district is searchable and focuses the same full Assam DEM.
        page.get_by_role("button",name="Find your district",exact=True).last.click()
        expect(page.locator(".district-grid button")).to_have_count(35)
        scan(page,name+" district directory")
        page.get_by_label("Search districts",exact=True).fill("does-not-exist")
        expect(page.get_by_text("No matching district. Try another spelling.")).to_be_visible()
        page.get_by_label("Search districts",exact=True).fill("Dibrugarh")
        expect(page.locator(".district-grid button")).to_have_count(1)
        page.locator(".district-grid button").click()
        page.wait_for_timeout(500)
        before=canvas.screenshot()
        page.get_by_role("button",name="Zoom in",exact=True).click()
        page.wait_for_timeout(500)
        assert before!=canvas.screenshot(), "zoom-in button did not paint"
        page.get_by_role("button",name="Zoom out",exact=True).click()
        page.wait_for_timeout(500)
        before=canvas.screenshot()
        rect=canvas.bounding_box()
        page.mouse.move(rect["x"]+rect["width"]*.45,rect["y"]+rect["height"]*.5)
        page.mouse.wheel(0,-350);page.wait_for_timeout(500)
        assert before!=canvas.screenshot(), "wheel over the middle did not zoom"
        record(name+" all districts, district focus, zoom buttons and centre wheel")
        # Link keeps sourced district and timeline choices, with a usable copy fallback.
        live_resolution=canvas.evaluate("c=>[c.width,c.height]")
        # Compare terrain pixels without including HUD hover/focus changes.
        r=canvas.bounding_box()
        map_clip={"x":r["x"]+r["width"]*.2,"y":r["y"]+r["height"]*.4,"width":r["width"]*.6,"height":r["height"]*.3}
        live_paint=page.screenshot(clip=map_clip)
        page.get_by_role("button",name="Share this view",exact=True).click()
        link=page.get_by_label("Link to this view",exact=True).input_value()
        assert "district=2026441" in link and "mode=flow" in link
        page.get_by_role("button",name="Copy link",exact=True).click()
        expect(page.get_by_role("dialog")).to_contain_text("cop")
        expect(page.get_by_role("button",name="Save portrait story",exact=True)).to_be_enabled(timeout=15000)
        with page.expect_download() as portrait:
            page.get_by_role("button",name="Save portrait story",exact=True).click()
        story_target=OUT/("story-"+name+".png")
        portrait.value.save_as(str(story_target))
        assert struct.unpack(">II",story_target.read_bytes()[16:24]) == (1080,1920)
        expect(page.get_by_role("dialog")).to_contain_text("Ready to share")
        scan(page,name+" share dialog")
        page.screenshot(path=str(OUT/("share-"+name+".png")),full_page=True)
        page.keyboard.press("Escape")
        expect(page.get_by_role("button",name="Share this view",exact=True)).to_be_focused()
        assert canvas.evaluate("c=>[c.width,c.height]")==live_resolution, "Export changed live canvas resolution"
        assert page.screenshot(clip=map_clip)==live_paint, "Export changed the camera or scene"
        record(name+" portrait export, resolution restoration and share focus return")
        page.goto(link);page.wait_for_load_state("networkidle");ready(page)
        assert page.evaluate("document.querySelector('.region-selector button').getAttribute('aria-pressed')") == "true"
        page.get_by_role("button",name="Reset view",exact=True).click()
        record(name+" share link restores district")
        page.get_by_test_id("region-majuli").click()
        ready(page)
        page.get_by_role("button",name="Explore more",exact=True).click()
        page.get_by_test_id("scenario-play").click()
        expect(page.get_by_role("button",name="Pause scenario",exact=True)).to_be_visible()
        expect(page.get_by_test_id("scenario-wet")).not_to_contain_text("—")
        page.wait_for_timeout(1200)
        page.get_by_test_id("scenario-play").click()
        assert "could not continue" not in page.locator(".simulation-message").inner_text()
        page.get_by_role("button",name="Reset scenario",exact=True).click()
        # Layer switches must not rebuild/reset a paused simulation.
        snapshot=page.get_by_test_id("scenario-wet").inner_text()
        page.get_by_role("button",name="Explore & layers",exact=True).click()
        page.get_by_role("checkbox",name="River network",exact=True).uncheck()
        page.get_by_role("checkbox",name="River network",exact=True).check()
        page.get_by_role("button",name="Close",exact=True).click()
        assert snapshot==page.get_by_test_id("scenario-wet").inner_text()
        record(name+" flood run pause reset and stable layer controls")
        page.screenshot(path=str(OUT/("majuli-water-"+name+".png")),full_page=True)
        # Depth styling reads the same solver field; it must not reset water.
        surface_paint=canvas.screenshot()
        page.get_by_role("button",name="Depth bands",exact=True).click()
        expect(page.get_by_role("button",name="Depth bands",exact=True)).to_have_attribute("aria-pressed","true")
        page.wait_for_timeout(500)
        assert surface_paint!=canvas.screenshot(), "depth shader did not change paint"
        assert snapshot==page.get_by_test_id("scenario-wet").inner_text()
        page.get_by_role("button",name="River cross-section",exact=True).click()
        expect(page.get_by_test_id("section-depth")).to_contain_text("2.00 m")
        scan(page,name+" depth section")
        page.screenshot(path=str(OUT/("depth-section-"+name+"-en.png")),full_page=True)
        page.get_by_role("radio",name="অসমীয়া").check()
        scan(page,name+" depth section Assamese")
        page.screenshot(path=str(OUT/("depth-section-"+name+"-as.png")),full_page=True)
        page.get_by_role("radio",name="ইংৰাজী").check()
        old_location=page.locator(".section-location").inner_text()
        page.locator("#section-position").fill("0.7")
        expect(page.locator(".section-location")).not_to_have_text(old_location)
        page.locator("#scenario-depth").fill("4")
        expect(page.get_by_test_id("section-depth")).to_contain_text("4.00 m")
        page.get_by_role("button",name="River cross-section",exact=True).click()
        page.get_by_role("button",name="Surface motion",exact=True).click()
        record(name+" depth styling and moving solver cross-section")
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
        page.get_by_role("button",name="Share this view",exact=True).click()
        with page.expect_download() as downloaded:
            page.get_by_role("button",name="Save map image",exact=True).click()
        target=OUT/("export-"+name+".png")
        downloaded.value.save_as(str(target))
        assert target.stat().st_size>10000
        page.keyboard.press("Escape")
        record(name+" attributed image export")
        page.locator("#scenario-depth").fill("3.5")
        page.get_by_text("Scenario inflow",exact=True).click()
        page.locator("#scenario-inflow").fill("12500")
        page.get_by_role("button",name="Share this view",exact=True).click()
        scenario_link=page.get_by_label("Link to this view",exact=True).input_value()
        page.goto(scenario_link);page.wait_for_load_state("networkidle");ready(page)
        expect(page.get_by_test_id("region-majuli")).to_have_attribute("aria-pressed","true")
        expect(page.locator("#scenario-depth")).to_have_value("3.5")
        expect(page.get_by_test_id("scenario-play")).to_have_text("Run scenario")
        page.get_by_role("button",name="Explore more",exact=True).click()
        page.get_by_text("Scenario inflow",exact=True).click()
        expect(page.locator("#scenario-inflow")).to_have_value("12500")
        expect(page.get_by_test_id("scenario-wet")).to_contain_text("—")
        record(name+" scenario link restores chosen inputs without running water")
        page.get_by_test_id("mode-fault").click()
        expect(page.get_by_test_id("region-majuli")).to_have_count(0)
        expect(page.get_by_test_id("region-sadiya-dibrugarh")).to_have_count(0)
        page.get_by_role("button",name="Explore & layers",exact=True).click()
        terrain_controls=page.get_by_role("dialog")
        terrain_controls.get_by_text("Terrain settings",exact=True).click()
        expect(page.locator("input[name=terrain-area]")).to_have_count(0)
        page.get_by_role("button",name="Close",exact=True).click()
        record(name+" FAULT only exposes Assam terrain")
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
        page.get_by_role("button",name="Explore the 1950 earthquake",exact=True).click()
        page.get_by_role("button",name="Illustrate ground motion",exact=True).click()
        expect(page.locator(".motion-note")).to_contain_text("synthetic")
        record(name+" earthquake records, empty state and replay")
        if name=="mobile":
            page.evaluate("() => { window.originalExport=HTMLCanvasElement.prototype.toDataURL; HTMLCanvasElement.prototype.toDataURL=function(){throw new Error('drawing buffer unavailable')}; }")
            page.get_by_role("button",name="Share this view",exact=True).click()
            expect(page.get_by_role("dialog")).to_contain_text("Could not save this view")
            expect(page.get_by_label("Link to this view",exact=True)).to_be_visible()
            page.evaluate("() => { HTMLCanvasElement.prototype.toDataURL=window.originalExport; }")
            page.keyboard.press("Escape")
            page.get_by_role("button",name="Share this view",exact=True).click()
            expect(page.get_by_role("button",name="Save portrait story",exact=True)).to_be_enabled(timeout=15000)
            page.keyboard.press("Escape")
            record("failed image capture preserves links and recovers on retry")
        assert not errors, errors
        context.close()
    if not args.shots:
        # Normal motion produces terrain-following waves; reduced motion above
        # keeps the same selected-event context without animation.
        normal=browser.new_context(viewport={"width":1440,"height":900},reduced_motion="no-preference")
        motion_page=normal.new_page()
        motion_page.goto(args.url+"?mode=fault")
        motion_page.wait_for_load_state("networkidle")
        motion_page.get_by_role("button",name="Explore more",exact=True).click()
        motion_page.get_by_role("button",name="Explore the 1950 earthquake",exact=True).click()
        motion_page.wait_for_timeout(4700)
        before=motion_page.get_by_test_id("terrain-canvas").screenshot()
        motion_page.get_by_role("button",name="Illustrate ground motion",exact=True).click()
        motion_page.wait_for_timeout(650)
        assert before!=motion_page.get_by_test_id("terrain-canvas").screenshot()
        motion_page.screenshot(path=str(OUT/"quake-motion-desktop.png"),full_page=True)
        record("earthquake illustration animates on real terrain")
        normal.close()
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
