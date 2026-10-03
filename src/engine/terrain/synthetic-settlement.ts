import * as THREE from 'three';

/** Original miniature architecture. No real coordinates, heights or vulnerability data. */
export function createSyntheticSettlement(
  scale: number,
  palette: { high: string; muted: string; surface: string; water: string },
) {
  const group = new THREE.Group();
  const pivots: THREE.Group[] = [];
  const pavement = new THREE.Mesh(
    new THREE.BoxGeometry(scale * 0.53, scale * 0.002, scale * 0.16),
    new THREE.MeshStandardMaterial({ color: palette.surface, roughness: 1 }),
  );
  group.add(pavement);
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 9; column++) {
      const syntheticFloors = 2 + ((column * 7 + row * 3) % 6);
      const width = scale * (column % 3 === 0 ? 0.026 : 0.019);
      const depth = scale * 0.023;
      const height = scale * syntheticFloors * 0.006;
      const pivot = new THREE.Group();
      pivot.position.set(
        scale * (-0.23 + column * 0.057),
        scale * 0.001,
        scale * (-0.055 + row * 0.052),
      );
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({
          color: column % 3 ? palette.high : palette.muted,
          roughness: 0.75,
          metalness: 0.12,
        }),
      );
      body.position.y = height / 2;
      pivot.add(body);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(body.geometry),
        new THREE.LineBasicMaterial({
          color: palette.high,
          transparent: true,
          opacity: 0.35,
        }),
      );
      edges.position.y = height / 2;
      pivot.add(edges);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(width * 1.08, scale * 0.001, depth * 1.08),
        new THREE.MeshStandardMaterial({ color: palette.surface, roughness: 1 }),
      );
      roof.position.y = height;
      pivot.add(roof);
      const windows = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(scale * 0.0025, scale * 0.002),
        new THREE.MeshBasicMaterial({
          color: palette.water,
          transparent: true,
          opacity: 0.7,
        }),
        syntheticFloors * 6,
      );
      const dummy = new THREE.Object3D();
      for (let floor = 0; floor < syntheticFloors; floor++) {
        for (let side = 0; side < 2; side++) {
          for (let window = 0; window < 3; window++) {
            dummy.position.set(
              side ? width / 2 + scale * 0.0001 : ((window - 1) * width) / 4,
              (floor + 0.6) * scale * 0.006,
              side ? ((window - 1) * depth) / 4 : depth / 2 + scale * 0.0001,
            );
            dummy.rotation.y = side ? Math.PI / 2 : 0;
            dummy.updateMatrix();
            windows.setMatrixAt(floor * 6 + side * 3 + window, dummy.matrix);
          }
        }
      }
      pivot.add(windows);
      group.add(pivot);
      pivots.push(pivot);
    }
  }
  // Schematic road markings provide scale cues, not a street map.
  for (const z of [-0.027, 0.025]) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-scale * 0.26, scale * 0.0011, scale * z),
        new THREE.Vector3(scale * 0.26, scale * 0.0011, scale * z),
      ]),
      new THREE.LineDashedMaterial({
        color: palette.muted,
        dashSize: scale * 0.008,
        gapSize: scale * 0.005,
      }),
    );
    line.computeLineDistances();
    group.add(line);
  }
  return { group, pivots };
}
