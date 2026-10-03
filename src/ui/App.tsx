import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Layers,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  Waves,
  MapPin,
  Plus,
  Minus,
  Share2,
  Check,
} from 'lucide-react';
import { ATLAS_COPY } from '../shared/i18n/atlas.js';
import { FLOOD_HISTORY } from '../shared/flood-history.js';
import type { Mode } from '../shared/types.js';
import catalogue from '../data/earthquakes.json';
import districts from '../data/districts.json';
import districtDownloadUrl from '../data/districts.json?url';
import {
  CATALOGUE_END_YEAR,
  CATALOGUE_CUTOFF,
  CATALOGUE_RETRIEVED,
} from '../shared/catalogue.js';
import { createViewLink } from '../shared/view-link.js';
import { useUiStore, initialPresentation } from './state/useUiStore.js';
import { useTerrainView, type AreaId } from './terrain/useTerrainView.js';
import TerrainScene from './terrain/TerrainScene.js';
import TerrainPanel from './terrain/TerrainPanel.js';
import TerrainLegend from './terrain/TerrainLegend.js';
import TerrainReadout from './terrain/TerrainReadout.js';
import TerrainAttribution from './terrain/TerrainAttribution.js';
import ModeRail from './ModeRail.js';
import LangToggle from './LangToggle.js';
import AtlasDialog from './AtlasDialog.js';
import AtlasDock from './AtlasDock.js';
import { saveAtlasImage } from './saveAtlasImage.js';
import FlowSection from './FlowSection.js';

const major = catalogue.events.reduce((a, b) => (a.magnitude > b.magnitude ? a : b));
export default function App() {
  const view = useTerrainView();
  const locale = useUiStore((s) => s.locale);
  const copy = ATLAS_COPY[locale];
  const reduced = useReducedMotion();
  const atlas = useUiStore((s) => s.atlas);
  const setAtlas = useUiStore((s) => s.setAtlas);
  const [drawer, setDrawer] = useState<
    'sources' | 'safety' | 'layers' | 'history' | 'districts' | 'share' | null
  >(null);
  const [focus, setFocus] = useState(false);
  const [level, setLevel] = useState(2);
  const [historyPlaying, setHistoryPlaying] = useState(false);
  const [collisionPlaying, setCollisionPlaying] = useState(false);
  const [story, setStory] = useState(2);
  const [notice, setNotice] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [shareLink, setShareLink] = useState('');
  const selectedDistrict = districts.districts.find(
    (d) => d.id === atlas.selectedDistrict,
  );
  const ready = view.state.status.phase === 'ready';
  const sidecar = view.state.status.phase === 'ready' ? view.state.status.sidecar : null;
  const mode = atlas.mode;
  // FAULT is always the full Assam view, including browser-history navigation.
  useEffect(() => {
    if (mode === 'fault' && view.areaId !== 'assam-overview')
      view.setArea('assam-overview');
  }, [mode, view.areaId, view.setArea]);
  useEffect(() => {
    if (ready) view.setAtlas({ ...atlas, locale });
  }, [atlas, locale, ready, view.setAtlas]);
  useEffect(() => {
    if (
      ready &&
      selectedDistrict &&
      view.areaId === 'assam-overview' &&
      mode !== 'plates'
    )
      view.focusLocation(selectedDistrict.longitude, selectedDistrict.latitude);
  }, [ready, selectedDistrict, view.areaId, mode, view.focusLocation]);
  useEffect(() => {
    const onPop = () => {
      const restored = initialPresentation();
      setAtlas(restored);
      useUiStore.getState().setLocale(restored.locale);
      setHistoryPlaying(false);
      setCollisionPlaying(false);
      view.setWaterOn(false);
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [setAtlas, view.setWaterOn]);
  useEffect(() => {
    if (!historyPlaying) return;
    const id = setInterval(
      () =>
        setAtlas((a) => {
          if (a.quakeYear >= CATALOGUE_END_YEAR) {
            setHistoryPlaying(false);
            return a;
          }
          const year = a.quakeYear + 1;
          const latest = catalogue.events
            .filter((e) => Number(e.time.slice(0, 4)) === year)
            .sort((a, b) => b.magnitude - a.magnitude)[0];
          return { ...a, quakeYear: year, selectedQuake: latest?.id ?? a.selectedQuake };
        }),
      220,
    );
    return () => clearInterval(id);
  }, [historyPlaying, setAtlas]);
  useEffect(() => {
    if (!collisionPlaying) return;
    if (reduced) {
      setAtlas((a) => ({ ...a, collision: 1 }));
      setCollisionPlaying(false);
      return;
    }
    const id = setInterval(
      () =>
        setAtlas((a) => {
          if (a.collision >= 1) {
            setCollisionPlaying(false);
            return a;
          }
          return { ...a, collision: Math.min(1, a.collision + 0.0125) };
        }),
      150,
    );
    return () => clearInterval(id);
  }, [collisionPlaying, reduced, setAtlas]);
  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) {
        setHistoryPlaying(false);
        setCollisionPlaying(false);
        view.setWaterPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [view.setWaterPlaying]);
  const setMode = (next: Mode) => {
    if (next === mode) return;
    view.setWaterOn(false);
    setHistoryPlaying(false);
    setCollisionPlaying(false);
    const nextAtlas = {
      ...atlas,
      mode: next,
      selectedQuake: next === 'fault' ? major.id : atlas.selectedQuake,
      quakeYear: CATALOGUE_END_YEAR,
    };
    setAtlas(nextAtlas);
    if (next !== 'flow') view.setArea('assam-overview');
    history.pushState(null, '', createViewLink(location.href, { ...nextAtlas, locale }));
  };
  const save = async () => {
    try {
      const png = view.captureImage();
      if (!png) throw new Error('not-ready');
      await saveAtlasImage(png, mode, copy, {
        attribution: sidecar?.attribution ?? '',
        note:
          mode === 'plates'
            ? copy.platesNote
            : `${[copy.overview, copy.majuli, copy.sadiya][['assam-overview', 'majuli', 'sadiya-dibrugarh'].indexOf(view.areaId)]} · ${copy.height} ${view.exaggeration}× · ${mode === 'flow' ? `${copy.level} ${level.toFixed(1)} m · ${copy.inflowSettings} ${view.water?.dischargeM3s ?? 0} m³/s${atlas.flowView === 'depth' ? ` · ${copy.depthExport}` : ''}` : `${copy.year} ${atlas.quakeYear}`}`,
      });
      setNotice(copy.saved);
    } catch {
      setNotice(copy.invalidCapture);
    }
  };
  const changeArea = (id: AreaId) => {
    setAtlas((a) => ({ ...a, selectedDistrict: null }));
    view.setArea(id);
    setHistoryPlaying(false);
  };
  const icon = { size: 18, strokeWidth: 1.5, 'aria-hidden': true as const };
  const layerControls = (
    <>
      <button
        className="district-launch"
        type="button"
        disabled={!ready}
        onClick={() => setDrawer('districts')}
      >
        <MapPin {...icon} /> <span>{selectedDistrict?.name ?? copy.districtExplore}</span>
        <ArrowUpRight {...icon} />
      </button>
      <h3>{copy.geography}</h3>
      {(['districts', 'rivers', 'boundaries', 'places'] as const).map((key) => (
        <label className="layer-toggle" key={key}>
          <input
            type="checkbox"
            checked={atlas[key]}
            onChange={(e) => setAtlas((a) => ({ ...a, [key]: e.target.checked }))}
          />
          <span>{copy[key]}</span>
          <span className="layer-indicator" aria-hidden="true" />
        </label>
      ))}
      <p className="fine-print">{copy.riverCredit}</p>
      <details className="terrain-details">
        <summary>{copy.terrain}</summary>
        <TerrainPanel
          overviewOnly={mode === 'fault'}
          areaId={view.areaId}
          onArea={changeArea}
          exaggeration={view.exaggeration}
          onExaggeration={view.setExaggeration}
          contours={view.contours}
          onContours={view.setContours}
          onReset={view.resetCamera}
          disabled={!ready}
        />
      </details>
    </>
  );
  return (
    <div
      className={`atlas-app${focus ? ' is-focused' : ''}`}
      data-mode={mode}
      data-locale={locale}
      data-testid="app"
    >
      <a className="skip-link sr-only" href="#main">
        {copy.skip}
      </a>
      <header className="atlas-header">
        <a href="#main" className="brand" aria-label="Fault & Flow">
          <Waves {...icon} />
          <h1 data-testid="wordmark">
            Fault <span>&</span> Flow
          </h1>
        </a>
        <ModeRail mode={mode} onMode={setMode} copy={copy} />
        <div className="header-actions">
          <LangToggle />
          <button
            className="icon-button"
            type="button"
            onClick={() => setDrawer('safety')}
            aria-label={copy.safety}
          >
            <ShieldCheck {...icon} />
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="atlas-map" data-testid="terrain-scene">
        <TerrainScene view={view} copy={copy} />
        {!focus && (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                className="atlas-intro"
                initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {mode === 'flow' && atlas.sectionOpen ? (
                  <FlowSection
                    copy={copy}
                    atlas={atlas}
                    profile={view.water?.section ?? null}
                    onPosition={(sectionPosition) =>
                      setAtlas((a) => ({ ...a, sectionPosition }))
                    }
                  />
                ) : (
                  <>
                    <p className="eyebrow">{copy.eyebrow}</p>
                    <h2>{copy[`${mode}Title`]}</h2>
                    <p className="intro-copy">{copy[`${mode}Description`]}</p>
                    {mode === 'flow' && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => changeArea('majuli')}
                      >
                        {copy.explore}
                        <ArrowDownRight {...icon} />
                      </button>
                    )}
                    {mode === 'fault' && (
                      <p className="seismic-note">{copy.noPrediction}</p>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
            {mode !== 'plates' && (
              <>
                <aside className="atlas-layer-panel" aria-label={copy.geography}>
                  {layerControls}
                </aside>
                {mode === 'flow' && (
                  <div className="region-selector" role="group" aria-label={copy.region}>
                    {(['assam-overview', 'majuli', 'sadiya-dibrugarh'] as const).map(
                      (id, i) => (
                        <button
                          type="button"
                          key={id}
                          aria-pressed={view.areaId === id}
                          disabled={!ready}
                          onClick={() => changeArea(id)}
                          data-testid={`region-${id}`}
                        >
                          {[copy.overview, copy.majuli, copy.sadiya][i]}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
        <div className="map-tools" role="group" aria-label={copy.tools}>
          {mode !== 'plates' && (
            <>
              <button
                type="button"
                className="icon-button"
                disabled={!ready}
                onClick={() => setDrawer('districts')}
                aria-label={copy.districtExplore}
              >
                <MapPin {...icon} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={!ready}
                onClick={() => view.zoomView(0.75)}
                aria-label={copy.zoomIn}
              >
                <Plus {...icon} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={!ready}
                onClick={() => view.zoomView(1 / 0.75)}
                aria-label={copy.zoomOut}
              >
                <Minus {...icon} />
              </button>
            </>
          )}
          {mode !== 'plates' && (
            <button
              type="button"
              className="icon-button mobile-layers"
              onClick={() => setDrawer('layers')}
              aria-label={copy.controls}
            >
              <Layers {...icon} />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            disabled={!ready}
            onClick={() => {
              setAtlas((a) => ({ ...a, selectedDistrict: null }));
              view.resetCamera();
            }}
            aria-label={copy.resetView}
          >
            <RotateCcw {...icon} />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={!ready}
            aria-label={copy.share}
            onClick={() => {
              setShareLink(createViewLink(location.href, { ...atlas, locale }));
              setNotice('');
              setDrawer('share');
            }}
          >
            <Share2 {...icon} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setFocus((v) => !v)}
            aria-label={focus ? copy.exitFull : copy.full}
          >
            {focus ? <Minimize2 {...icon} /> : <Maximize2 {...icon} />}
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={!ready}
            onClick={() => void save()}
            aria-label={copy.save}
          >
            <Download {...icon} />
          </button>
        </div>
        <div
          className={`map-caption${mode === 'flow' && atlas.flowView === 'depth' ? ' is-depth' : ''}`}
        >
          {mode === 'flow' && atlas.flowView === 'depth' && (
            <span className="depth-ramp" aria-hidden="true" />
          )}
          <span className="caption-dot" />
          {mode === 'fault'
            ? copy.quakeNote
            : mode === 'plates'
              ? copy.platesNote
              : atlas.flowView === 'depth'
                ? copy.depthScale
                : copy.riverNote}
        </div>
        <div className="map-scale">
          {mode !== 'plates' && (
            <>
              {copy.height} <strong>{view.exaggeration}×</strong>
            </>
          )}
          <span>{copy.mapHint}</span>
        </div>
      </main>
      {!focus && (
        <AtlasDock
          copy={copy}
          view={view}
          atlas={atlas}
          setAtlas={setAtlas}
          level={level}
          setLevel={setLevel}
          historyPlaying={historyPlaying}
          setHistoryPlaying={setHistoryPlaying}
          collisionPlaying={collisionPlaying}
          setCollisionPlaying={setCollisionPlaying}
          onHistory={() => setDrawer('history')}
          onRiver={() => setMode('flow')}
        />
      )}
      <footer className="atlas-footer">
        <p data-testid="disclaimer">
          <ShieldCheck {...icon} />
          {copy.disclaimer}
        </p>
        {mode !== 'plates' && (
          <a
            className="district-credit"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            {copy.districtCredit}
          </a>
        )}
        <button type="button" onClick={() => setDrawer('sources')}>
          {copy.sources}
          <ArrowUpRight {...icon} />
        </button>
      </footer>
      <p className="sr-only" role="status">
        {drawer === 'share' ? '' : notice}
      </p>
      <AtlasDialog
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={
          drawer === 'sources'
            ? copy.sources
            : drawer === 'safety'
              ? copy.safetyTitle
              : drawer === 'history'
                ? copy.floodHistory
                : drawer === 'districts'
                  ? copy.districtExplore
                  : drawer === 'share'
                    ? copy.share
                    : copy.controls
        }
        closeLabel={copy.close}
      >
        {drawer === 'layers' && layerControls}
        {drawer === 'districts' && (
          <>
            <p>{copy.districtNote}</p>
            <label htmlFor="district-search">{copy.districtSearch}</label>
            <input
              id="district-search"
              className="district-search"
              type="search"
              value={districtSearch}
              onChange={(e) => setDistrictSearch(e.target.value)}
            />
            <p className="district-count">
              {copy.allDistricts} · {districts.districts.length}
            </p>
            <div className="district-grid">
              {districts.districts
                .filter((d) =>
                  `${d.name} ${d.sourceName} ${d.nameAs}`
                    .toLowerCase()
                    .includes(districtSearch.trim().toLowerCase()),
                )
                .map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    aria-pressed={atlas.selectedDistrict === d.id}
                    onClick={() => {
                      view.setArea('assam-overview');
                      setAtlas((a) => ({
                        ...a,
                        districts: true,
                        selectedDistrict: d.id,
                      }));
                      view.focusLocation(d.longitude, d.latitude);
                      setDrawer(null);
                    }}
                  >
                    {atlas.selectedDistrict === d.id ? (
                      <Check {...icon} />
                    ) : (
                      <MapPin {...icon} />
                    )}
                    <span>{locale === 'as' && d.nameAs ? d.nameAs : d.name}</span>
                    <ArrowUpRight {...icon} />
                  </button>
                ))}
            </div>
            {!districts.districts.some((d) =>
              `${d.name} ${d.sourceName} ${d.nameAs}`
                .toLowerCase()
                .includes(districtSearch.trim().toLowerCase()),
            ) && <p role="status">{copy.districtEmpty}</p>}
            <a href={districtDownloadUrl} download="assam-district-names-odbl.json">
              {copy.districtCredit} <Download {...icon} />
            </a>
          </>
        )}
        {drawer === 'share' && (
          <>
            <p>{copy.shareNote}</p>
            <label htmlFor="view-link">{copy.viewLink}</label>
            <input
              id="view-link"
              className="district-search"
              value={shareLink}
              readOnly
              onFocus={(e) => e.target.select()}
            />
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                void (async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                    setNotice(copy.linkCopied);
                  } catch {
                    setNotice(copy.linkFailed);
                  }
                })()
              }
            >
              {copy.copyLink}
            </button>
            <p role="status">{notice}</p>
          </>
        )}
        {drawer === 'sources' && (
          <>
            <p>{copy.riverCredit}</p>
            <p>{copy.usgsCredit}</p>
            <p>{copy.catalogueNote}</p>
            <p className="snapshot-note">
              {copy.snapshot} <strong>{CATALOGUE_CUTOFF} UTC</strong> · {copy.retrieved}{' '}
              {CATALOGUE_RETRIEVED}
            </p>
            <p>{copy.updateNote}</p>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              {copy.districtCredit}
            </a>
            <p>{copy.noPrediction}</p>
            <TerrainLegend
              sidecar={sidecar}
              ramp={view.state.ramp}
              exaggeration={view.exaggeration}
              contourIntervalM={view.state.contourIntervalM}
              contoursOn={view.contours}
              waterOn={view.waterOn}
              waterMaxDepthM={view.water?.maxDepthM ?? null}
            />
            <TerrainReadout
              pointer={view.state.probe}
              cameraTarget={view.cameraTargetProbe}
              ready={ready}
            />
            <TerrainAttribution sidecar={sidecar} />
          </>
        )}
        {drawer === 'safety' && (
          <>
            <p>{copy.safetyBody}</p>
            <p className="safety-notice">{copy.safetyNow}</p>
            <p>
              <strong>{copy.noPrediction}</strong>
            </p>
            <h3>{copy.floodLimits}</h3>
            <p>{copy.floodLimitsBody}</p>
            <h3>{copy.quakeLimits}</h3>
            <p>{copy.quakeLimitsBody}</p>
            <p>{copy.safetyActions}</p>
            <div className="official-links">
              {[
                ['https://asdma.assam.gov.in/', copy.asdma],
                ['https://seismo.gov.in/', copy.ncs],
                ['https://mausam.imd.gov.in/', copy.imd],
              ].map(([url, label]) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  {label}
                  <ArrowUpRight {...icon} />
                </a>
              ))}
            </div>
          </>
        )}
        {drawer === 'history' && (
          <>
            <p>{copy.historyNote}</p>
            <div className="story-tabs">
              {FLOOD_HISTORY.map((item, i) => (
                <button
                  key={item.year}
                  type="button"
                  aria-pressed={story === i}
                  onClick={() => setStory(i)}
                >
                  {item.year}
                </button>
              ))}
            </div>
            <article className="flood-story">
              <p className="eyebrow">NASA EARTH OBSERVATORY · {copy.historical}</p>
              <h3>{copy[FLOOD_HISTORY[story]!.title]}</h3>
              <p>{copy[FLOOD_HISTORY[story]!.body]}</p>
              <a href={FLOOD_HISTORY[story]!.url} target="_blank" rel="noreferrer">
                {copy.readReport}
                <ArrowUpRight {...icon} />
              </a>
            </article>
          </>
        )}
      </AtlasDialog>
    </div>
  );
}
