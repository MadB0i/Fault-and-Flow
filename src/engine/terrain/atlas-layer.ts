/** Browser rendering adapter for cited map features and a synthetic collision diagram. */
import * as THREE from 'three';
import geography from '../../data/geography.json';
import catalogue from '../../data/earthquakes.json';
import {
  INITIAL_ATLAS,
  type AtlasPresentation,
  type RiverSection,
} from '../../shared/atlas.js';
import { ATLAS_COPY } from '../../shared/i18n/atlas.js';
import { sampleBilinear } from './sampling.js';
import { extentMeters } from './metrics.js';
import type { TerrainSidecar } from './sidecar.js';

type Palette = {
  water: string;
  text: string;
  amber: string;
  muted: string;
  ground: string;
  high: string;
  surface: string;
};
type Ground = { sidecar: TerrainSidecar; heights: Float32Array; noData: Uint8Array };

export function createAtlasLayer(
  scene: THREE.Scene,
  doc: Document,
  palette: Palette,
  reducedMotion: boolean,
) {
  const map = new THREE.Group();
  const rivers = new THREE.Group();
  const borders = new THREE.Group();
  const places = new THREE.Group();
  const quakes = new THREE.Group();
  const plates = new THREE.Group();
  const section = new THREE.Group();
  map.add(rivers, borders, places, quakes, section);
  scene.add(map, plates);
  let presentation = { ...INITIAL_ATLAS };
  let ground: Ground | null = null;
  let exaggeration = 1;
  let span = 1;
  let markers: THREE.InstancedMesh | null = null;
  let waves: THREE.LineSegments[] = [];
  let epicentre: THREE.Vector3 | null = null;
  let eventVisible = false;
  let selectedAge = 2;
  let motionAge = 2;
  const dummy = new THREE.Object3D();
  const labelMetrics = new WeakMap<THREE.Sprite, { height: number; ratio: number }>();
  const riverOpacity = new WeakMap<THREE.MeshBasicMaterial, number>();
  const positionFor = (lon: number, lat: number, lift = 0): THREE.Vector3 | null => {
    if (!ground) return null;
    const { sidecar: s } = ground;
    const u = (lon - s.bbox.west) / (s.bbox.east - s.bbox.west);
    const v = (s.bbox.north - lat) / (s.bbox.north - s.bbox.south);
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    const h = sampleBilinear(ground.heights, ground.noData, s, u, v);
    const e = extentMeters(s);
    return new THREE.Vector3(
      (u - 0.5) * e.widthM,
      (h.noData ? 0 : h.elevationM) * exaggeration + lift,
      (v - 0.5) * e.heightM,
    );
  };
  function clear(group: THREE.Group) {
    group.traverse((o) => {
      if (
        o instanceof THREE.Mesh ||
        o instanceof THREE.Line ||
        o instanceof THREE.Sprite
      ) {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line)
          (o.geometry as THREE.BufferGeometry).dispose();
        const materials: THREE.Material[] = Array.isArray(o.material)
          ? (o.material as THREE.Material[])
          : [o.material as THREE.Material];
        for (const m of materials) {
          const texture = (m as THREE.MeshBasicMaterial).map;
          if (texture instanceof THREE.Texture) texture.dispose();
          m.dispose();
        }
      }
    });
    group.clear();
  }
  function points(coordinates: number[][], lift: number): THREE.Vector3[][] {
    const segments: THREE.Vector3[][] = [];
    let segment: THREE.Vector3[] = [];
    for (let i = 1; i < coordinates.length; i++) {
      const a = coordinates[i - 1]!;
      const b = coordinates[i]!;
      const steps = Math.max(
        1,
        Math.ceil(Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) / 0.01),
      );
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        const p = positionFor(
          a[0]! + (b[0]! - a[0]!) * t,
          a[1]! + (b[1]! - a[1]!) * t,
          lift,
        );
        if (p) segment.push(p);
        else if (segment.length) {
          if (segment.length > 1) segments.push(segment);
          segment = [];
        }
      }
    }
    if (segment.length > 1) segments.push(segment);
    return segments;
  }
  function ribbon(path: THREE.Vector3[], width: number, opacity: number) {
    const vertices: number[] = [];
    const indices: number[] = [];
    path.forEach((p, i) => {
      const tangent = path[Math.min(i + 1, path.length - 1)]!.clone()
        .sub(path[Math.max(0, i - 1)]!)
        .normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width / 2);
      vertices.push(p.x + side.x, p.y, p.z + side.z, p.x - side.x, p.y, p.z - side.z);
      if (i) {
        const n = i * 2;
        indices.push(n - 2, n - 1, n, n - 1, n + 1, n);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    const m = new THREE.MeshBasicMaterial({
      color: palette.water,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, m);
    riverOpacity.set(m, opacity);
    mesh.renderOrder = 2;
    rivers.add(mesh);
  }
  function label(
    text: string,
    colour: string,
    width: number,
    position: THREE.Vector3,
    parent: THREE.Group,
  ) {
    const canvas = doc.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '500 54px "Instrument Sans", "Noto Sans Bengali", sans-serif';
    canvas.width = Math.ceil(ctx.measureText(text).width) + 48;
    ctx.font = '500 54px "Instrument Sans", "Noto Sans Bengali", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    ctx.shadowColor = palette.surface;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 12;
    ctx.strokeStyle = palette.surface;
    ctx.strokeText(text, canvas.width / 2, 48);
    ctx.fillText(text, canvas.width / 2, 48);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        sizeAttenuation: false,
        depthTest: false,
        depthWrite: false,
      }),
    );
    const labelHeight = width / span > 0.15 ? 0.032 : 0.034;
    sprite.position.copy(position);
    sprite.scale.set((labelHeight * canvas.width) / 96, labelHeight, 1);
    labelMetrics.set(sprite, { height: labelHeight, ratio: canvas.width / 96 });
    sprite.renderOrder = 5;
    parent.add(sprite);
  }
  function buildPlates() {
    clear(plates);
    if (!ground) return;
    const scale = span;
    const india = new THREE.Mesh(
      new THREE.BoxGeometry(scale * 0.6, scale * 0.035, scale * 0.3),
      new THREE.MeshStandardMaterial({ color: palette.ground, roughness: 0.8 }),
    );
    india.name = 'india';
    india.position.set(0, -scale * 0.04, scale * (0.24 - presentation.collision * 0.12));
    plates.add(india);
    const eurasia = new THREE.Mesh(
      new THREE.BoxGeometry(scale * 0.7, scale * 0.06, scale * 0.32),
      new THREE.MeshStandardMaterial({ color: palette.high, roughness: 0.85 }),
    );
    eurasia.position.set(0, -scale * 0.025, -scale * 0.15);
    plates.add(eurasia);
    // Decorative strata and wire edges make the cross-section legible. Their
    // thickness, shape and spacing are schematic, never geological data.
    for (const block of [india, eurasia]) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(block.geometry),
        new THREE.LineBasicMaterial({
          color: palette.amber,
          transparent: true,
          opacity: 0.32,
        }),
      );
      edges.position.copy(block.position);
      plates.add(edges);
      for (let layer = 1; layer <= 3; layer++) {
        const slice = new THREE.Mesh(
          block.geometry.clone(),
          new THREE.MeshStandardMaterial({
            color: layer % 2 ? palette.muted : palette.ground,
            roughness: 1,
          }),
        );
        slice.scale.set(1, 0.12, 1);
        slice.position.copy(block.position);
        slice.position.y -= scale * (0.028 + layer * 0.007);
        plates.add(slice);
      }
      const grid = new THREE.GridHelper(scale * 0.6, 16, palette.amber, palette.muted);
      grid.position.copy(block.position);
      grid.position.y += block === india ? scale * 0.018 : scale * 0.031;
      grid.scale.z = 0.45;
      const mat = grid.material as THREE.Material;
      mat.transparent = true;
      mat.opacity = 0.16;
      plates.add(grid);
    }
    // Original, explicitly synthetic ridge. No fabricated geographic elevation.
    const ridgeGeo = new THREE.PlaneGeometry(scale * 0.66, scale * 0.2, 180, 60);
    ridgeGeo.rotateX(-Math.PI / 2);
    const pos = ridgeGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / scale;
      const z = pos.getZ(i) / scale;
      const syntheticPeak =
        Math.exp(-Math.pow((z + 0.009 * Math.sin(x * 28)) / 0.042, 2)) *
        (0.034 +
          0.016 * Math.abs(Math.sin(x * 89 + z * 53)) +
          0.015 * Math.abs(Math.sin(x * 151 - z * 93)) +
          0.012 * Math.sin(x * 24));
      pos.setY(i, scale * syntheticPeak * (0.15 + presentation.collision));
    }
    ridgeGeo.computeVertexNormals();
    plates.add(
      new THREE.Mesh(
        ridgeGeo,
        new THREE.MeshStandardMaterial({
          color: palette.high,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
      ),
    );
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, scale * 0.008, scale * 0.25),
      scale * 0.16,
      new THREE.Color(palette.amber),
      scale * 0.035,
      scale * 0.025,
    );
    plates.add(arrow);
    const ambient = new THREE.AmbientLight(palette.text, 0.8);
    plates.add(ambient);
    const sun = new THREE.DirectionalLight(palette.text, 2);
    sun.position.set(-scale, scale, scale * 0.3);
    plates.add(sun);
    const copy = ATLAS_COPY[presentation.locale];
    label(
      copy.indianPlate,
      palette.amber,
      scale * 0.2,
      new THREE.Vector3(0, scale * 0.025, scale * 0.28),
      plates,
    );
    label(
      copy.eurasianPlate,
      palette.text,
      scale * 0.22,
      new THREE.Vector3(scale * 0.23, scale * 0.06, -scale * 0.24),
      plates,
    );
    label(
      copy.himalaya,
      palette.text,
      scale * 0.27,
      new THREE.Vector3(-scale * 0.22, scale * 0.11, 0),
      plates,
    );
  }
  function rebuild(next: Ground, ex: number) {
    ground = next;
    exaggeration = ex;
    span = extentMeters(next.sidecar).diagonalM;
    for (const g of [rivers, borders, places, quakes]) clear(g);
    for (const river of geography.rivers)
      for (const path of points(river.coordinates, span * 0.0012)) {
        // Cartographic width is deliberately stylised, never a measured channel width.
        const width = span * (river.name === 'Brahmaputra' ? 0.0032 : 0.001);
        ribbon(path, width * 2.2, 0.08);
        ribbon(path, width, 0.65);
        ribbon(path, width * 0.3, 0.95);
      }
    for (const boundary of geography.boundaries)
      for (const path of points(boundary.coordinates, span * 0.001)) {
        const geometry = new THREE.BufferGeometry().setFromPoints(path);
        const line = new THREE.Line(
          geometry,
          new THREE.LineDashedMaterial({
            color: boundary.name === 'Assam' ? palette.text : palette.muted,
            transparent: true,
            opacity: boundary.name === 'Assam' ? 0.55 : 0.22,
            dashSize: span * 0.006,
            gapSize: span * 0.003,
          }),
        );
        line.computeLineDistances();
        borders.add(line);
      }
    for (const place of geography.places.filter(
      (p) => !['Dispur', 'Thimphu', 'Punakha', 'Wangdue Prodrang'].includes(p.name),
    )) {
      const position = positionFor(
        place.coordinates[0]!,
        place.coordinates[1]!,
        span * 0.012,
      );
      if (position) label(place.name, palette.text, span * 0.085, position, places);
    }
    markers = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({
        color: palette.amber,
        transparent: true,
        opacity: 0.8,
      }),
      catalogue.events.length,
    );
    markers.frustumCulled = false;
    quakes.add(markers);
    waves = Array.from({ length: 3 }, (_, i) => {
      const wave = new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(96 * 6), 3).setUsage(
            THREE.DynamicDrawUsage,
          ),
        ),
        new THREE.LineBasicMaterial({
          color: i === 0 ? palette.text : palette.amber,
          transparent: true,
          opacity: 0.8,
          depthTest: false,
          depthWrite: false,
        }),
      );
      wave.frustumCulled = false;
      wave.renderOrder = 4;
      quakes.add(wave);
      return wave;
    });
    buildPlates();
    update(presentation);
  }
  function update(next: AtlasPresentation) {
    const changed = next.selectedQuake !== presentation.selectedQuake;
    const collisionChanged =
      next.collision !== presentation.collision || next.locale !== presentation.locale;
    if (next.motionIllustration !== presentation.motionIllustration) motionAge = 0;
    presentation = { ...next };
    map.visible = next.mode !== 'plates';
    plates.visible = next.mode === 'plates';
    rivers.visible = next.rivers;
    rivers.children.forEach((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.material instanceof THREE.MeshBasicMaterial
      )
        child.material.opacity =
          (riverOpacity.get(child.material) ?? 1) *
          (next.mode === 'flow' && next.flowView === 'depth' ? 0.2 : 1);
    });
    borders.visible = next.boundaries;
    places.visible = next.places;
    quakes.visible = next.mode === 'fault';
    if (collisionChanged) buildPlates();
    if (markers) {
      catalogue.events.forEach((event, i) => {
        const p = positionFor(event.longitude, event.latitude, span * 0.004);
        const shown = Number(event.time.slice(0, 4)) <= next.quakeYear && p !== null;
        dummy.position.copy(p ?? new THREE.Vector3());
        const size = shown
          ? span * 0.0011 * Math.pow(1.5, (event.magnitude ?? 5) - 5)
          : 0;
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        markers!.setMatrixAt(i, dummy.matrix);
        if (event.id === next.selectedQuake && p) epicentre = p;
      });
      markers.instanceMatrix.needsUpdate = true;
    }
    eventVisible =
      next.mode === 'fault' &&
      catalogue.events.some(
        (e) =>
          e.id === next.selectedQuake &&
          Number(e.time.slice(0, 4)) <= next.quakeYear &&
          positionFor(e.longitude, e.latitude) !== null,
      );
    section.visible = next.mode === 'flow' && next.sectionOpen;
    if (changed) selectedAge = 0;
  }
  function step(dt: number) {
    selectedAge += dt;
    motionAge += dt;
    // Concentric, terrain-following display waves. Their radius, timing and
    // brightness are synthetic; none represents P/S arrival or shaking intensity.
    const age = Math.min(selectedAge, motionAge);
    if (!eventVisible)
      waves.forEach((wave) => {
        wave.visible = false;
      });
    if (eventVisible && ground && epicentre)
      waves.forEach((wave, i) => {
        const t = reducedMotion ? 1 : Math.min(1, Math.max(0, (age - i * 0.45) / 3.2));
        const radius = span * (0.008 + t * (0.055 + i * 0.02));
        const extent = extentMeters(ground!.sidecar);
        const vertices: THREE.Vector3[] = [];
        const at = (angle: number) => {
          const x = epicentre!.x + Math.cos(angle) * radius;
          const z = epicentre!.z + Math.sin(angle) * radius;
          const s = ground!.sidecar;
          return positionFor(
            s.bbox.west + (x / extent.widthM + 0.5) * (s.bbox.east - s.bbox.west),
            s.bbox.north - (z / extent.heightM + 0.5) * (s.bbox.north - s.bbox.south),
            span * 0.002,
          );
        };
        for (let j = 0; j < 96; j++) {
          const a = at((j / 96) * Math.PI * 2);
          const b = at(((j + 1) / 96) * Math.PI * 2);
          if (a && b) vertices.push(a, b);
        }
        const attribute = wave.geometry.getAttribute('position') as THREE.BufferAttribute;
        vertices.forEach((v, index) => attribute.setXYZ(index, v.x, v.y, v.z));
        attribute.needsUpdate = true;
        wave.geometry.setDrawRange(0, vertices.length);
        wave.visible = eventVisible && (reducedMotion || age >= i * 0.45);
        (wave.material as THREE.LineBasicMaterial).opacity = reducedMotion
          ? 0.6
          : 0.8 - t * 0.5;
      });
    return (
      !reducedMotion &&
      presentation.mode === 'fault' &&
      eventVisible &&
      (selectedAge < 4.2 || motionAge < 4.2)
    );
  }
  return {
    rebuild,
    update,
    step,
    setSection(profile: RiverSection | null) {
      clear(section);
      if (!profile || !ground) return;
      for (const path of points(
        [
          [profile.longitude, profile.northLatitude],
          [profile.longitude, profile.southLatitude],
        ],
        span * 0.003,
      )) {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(path),
          new THREE.LineDashedMaterial({
            color: palette.text,
            dashSize: span * 0.003,
            gapSize: span * 0.0015,
            depthTest: false,
            transparent: true,
            opacity: 0.9,
          }),
        );
        line.computeLineDistances();
        line.renderOrder = 6;
        section.add(line);
        if (path[0]) label('A', palette.text, span * 0.04, path[0], section);
        if (path.at(-1)) label('B', palette.text, span * 0.04, path.at(-1)!, section);
      }
    },
    /** Suppress overlapping labels without moving their geographic anchors. */
    layout(camera: THREE.Camera, width: number, height: number) {
      const rectangles: { left: number; right: number; top: number; bottom: number }[] =
        [];
      for (const parent of [places, plates])
        for (const object of parent.children) {
          if (!(object instanceof THREE.Sprite)) continue;
          const metric = labelMetrics.get(object as THREE.Sprite);
          if (!metric) continue;
          const size = metric.height * (parent === plates && width < 600 ? 0.65 : 1);
          object.scale.set(size * metric.ratio, size, 1);
          if (parent === plates) continue;
          const p = object.position.clone().project(camera);
          const x = ((p.x + 1) * width) / 2;
          const y = ((1 - p.y) * height) / 2;
          const w =
            (size * metric.ratio * camera.projectionMatrix.elements[0] * width) / 2;
          const h = (size * camera.projectionMatrix.elements[5] * height) / 2;
          const rect = {
            left: x - w / 2 - 4,
            right: x + w / 2 + 4,
            top: y - h / 2 - 4,
            bottom: y + h / 2 + 4,
          };
          object.visible =
            p.z >= -1 &&
            p.z <= 1 &&
            !rectangles.some(
              (r) =>
                rect.left < r.right &&
                rect.right > r.left &&
                rect.top < r.bottom &&
                rect.bottom > r.top,
            );
          if (object.visible) rectangles.push(rect);
        }
    },
    /** Original visual oscillation; amplitude is a display choice, never measured. */
    motionOffset: () =>
      reducedMotion || presentation.mode !== 'fault' || motionAge >= 1.5
        ? 0
        : span * 0.002 * Math.sin(motionAge * 44) * Math.exp(-motionAge * 2),
    dispose() {
      for (const g of [rivers, borders, places, quakes, plates, section]) clear(g);
      scene.remove(map, plates);
    },
  };
}
