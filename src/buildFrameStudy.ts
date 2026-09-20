import * as THREE from 'three';
import { loft, frameShell } from './frameSurfaces';
import definitions from './data/frame-studies.json';
export const frameStudies = definitions;
export type FrameStudy = (typeof definitions)[number];
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
export function framePoints(study: FrameStudy) {
  const g = study.geometry,
    r = Math.PI / 180;
  const bb = V(0, 0),
    rear = V(-Math.sqrt(g.chainstay ** 2 - g.bbDrop ** 2) / 1000, g.bbDrop / 1000);
  const front = V(rear.x + g.wheelbase / 1000, rear.y),
    head = V(g.reach / 1000, g.stack / 1000);
  const headAxis = V(Math.cos(g.headAngle * r), -Math.sin(g.headAngle * r));
  const seatAxis = V(-Math.cos(g.seatAngle * r), Math.sin(g.seatAngle * r));
  const headBottom = head.clone().addScaledVector(headAxis, g.headTube / 1000);
  const seat = seatAxis.clone().multiplyScalar(g.seatTube / 1000);
  const stay = seat.clone().addScaledVector(seatAxis, -study.shape.stayDrop / 1000);
  return { bb, rear, front, head, headBottom, seat, stay, headAxis, seatAxis };
}
export function buildFrameStudy(study: FrameStudy, ghost = false) {
  const group = new THREE.Group(),
    meshes: THREE.Mesh[] = [],
    tireGroup = new THREE.Group(),
    guideGroup = new THREE.Group();
  const p = framePoints(study),
    s = study.shape,
    kind = study.id;
  const material = new THREE.MeshPhysicalMaterial({
    color: '#839891',
    metalness: 0.5,
    roughness: 0.31,
    clearcoat: 0.5,
    clearcoatRoughness: 0.26,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: '#293b35',
    metalness: 0.45,
    roughness: 0.4,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: '#aab2ac',
    metalness: 0.78,
    roughness: 0.26,
  });
  const transparent = new THREE.MeshBasicMaterial({
    color: '#bc9eed',
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const usedMaterials = new Set<THREE.Material>([material, dark, metal, transparent]);
  function add(
    geo: THREE.BufferGeometry,
    part: string,
    mat: THREE.Material = material,
    parent: THREE.Group = group,
  ) {
    const mesh = new THREE.Mesh(geo, ghost ? transparent : mat);
    mesh.userData.part = part;
    parent.add(mesh);
    meshes.push(mesh);
    if (ghost) {
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 42),
        new THREE.LineBasicMaterial({
          color: '#b99be1',
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        }),
      );
      edge.renderOrder = 2;
      mesh.add(edge);
    }
    return mesh;
  }
  function tube(
    points: THREE.Vector3[],
    depth: number,
    width: number,
    part: string,
    mat: THREE.Material = material,
    taper = 1,
    round = 0.7,
  ) {
    return add(
      loft(
        points,
        [
          [0, depth / 1000, width / 1000],
          [0.45, depth / 1000, width / 1000],
          [1, (depth * taper) / 1000, (width * taper) / 1000],
        ],
        round,
      ),
      part,
      mat,
    );
  }
  const topHead = p.head.clone().addScaledVector(p.headAxis, 0.012),
    downHead = p.headBottom.clone().addScaledVector(p.headAxis, -0.012);
  const mid = p.seat.clone().lerp(topHead, 0.55);
  add(
    frameShell(
      [p.seat, mid, topHead, downHead, p.bb],
      [s.top, s.top, s.head, s.down, s.seat].map((v) => v / 1000),
      [0.03, 0.031, 0.044, s.downWidth / 1000, s.seatWidth / 1000],
    ),
    'tubes',
  );
  const post = p.seat.clone().addScaledVector(p.seatAxis, 0.15);
  tube([p.seat, post], s.post, s.postWidth, 'rear', dark, 1, kind === 'climbing' ? 1 : 0.76);
  // Headset rings and crown show the interface, while dimensions of the surfaces remain illustrative.
  tube(
    [p.head, p.head.clone().addScaledVector(p.headAxis, -0.006)],
    s.head * 0.9,
    44,
    'front',
    dark,
  );
  tube(
    [p.headBottom, p.headBottom.clone().addScaledVector(p.headAxis, 0.018)],
    s.head * 0.87,
    kind === 'gravel' ? 87 : 72,
    'front',
  );
  for (const sign of [-1, 1]) {
    const dropout = p.rear.clone().add(V(0, 0, 0.071 * sign));
    const start = p.bb.clone().add(V(0, 0, 0.035 * sign));
    tube(
      [
        start,
        start
          .clone()
          .lerp(dropout, 0.45)
          .add(V(0, -0.012, sign * (kind === 'gravel' ? 0.027 : 0.014))),
        dropout,
      ],
      kind === 'tt' ? 36 : 29,
      18,
      'rear',
      material,
      0.4,
    );
    const join = p.stay.clone().add(V(0, 0, 0.021 * sign));
    tube(
      [
        join,
        join
          .clone()
          .lerp(dropout, 0.5)
          .add(V(-0.004, 0, 0.01 * sign)),
        dropout,
      ],
      s.stay,
      12,
      'rear',
      material,
      0.7,
      0.85,
    );
    const crown = p.headBottom
      .clone()
      .addScaledVector(p.headAxis, 0.02)
      .add(V(0, 0, (kind === 'gravel' ? 0.041 : 0.033) * sign));
    const axle = p.front.clone().add(V(0, 0, 0.05 * sign));
    const leg = crown
      .clone()
      .lerp(axle, 0.56)
      .add(V(-0.012, 0, (kind === 'gravel' ? 0.021 : 0.008) * sign));
    tube([crown, leg, axle], s.fork, s.forkWidth, 'front', material, 0.38);
    for (const point of [dropout, axle]) {
      const hole = new THREE.TorusGeometry(0.007, 0.003, 10, 28);
      const ring = add(hole, 'front', metal);
      ring.position.copy(point);
    }
    if (kind === 'gravel') {
      for (const t of [0.38, 0.56, 0.74]) {
        const boss = add(new THREE.CylinderGeometry(0.004, 0.004, 0.007, 20), 'mounts', metal);
        boss.rotation.x = Math.PI / 2;
        boss.position.copy(
          crown
            .clone()
            .lerp(axle, t)
            .add(V(0, 0, 0.014 * sign)),
        );
      }
    }
  }
  // A hollow bottom bracket shell, not a solid black cylinder.
  const shell = new THREE.Shape();
  shell.absarc(0, 0, 0.026, 0, Math.PI * 2, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.018, 0, Math.PI * 2, true);
  shell.holes.push(bore);
  const bbGeo = new THREE.ExtrudeGeometry(shell, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSize: 0.001,
    bevelThickness: 0.001,
    bevelSegments: 2,
    curveSegments: 32,
  });
  bbGeo.translate(0, 0, -0.04);
  add(bbGeo, 'tubes', dark);
  if (kind === 'gravel') {
    for (const t of [0.32, 0.47]) {
      const boss = add(new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 20), 'mounts', metal);
      boss.position.copy(
        p.seat
          .clone()
          .lerp(topHead, t)
          .add(V(0, 0.018, 0)),
      );
    }
  }
  if (kind === 'tt') {
    const stem = p.head.clone().add(V(0.055, 0.02, 0));
    tube([p.head, stem], 37, 38, 'cockpit', dark);
    tube(
      [stem.clone().add(V(0.0, 0, -0.2)), stem, stem.clone().add(V(0, 0, 0.2))],
      26,
      18,
      'cockpit',
      dark,
    );
    for (const sign of [-1, 1]) {
      const root = stem.clone().add(V(0.005, 0.067, 0.078 * sign));
      tube([stem.clone().add(V(0, 0, 0.078 * sign)), root], 14, 14, 'cockpit', metal);
      const pad = add(new THREE.BoxGeometry(0.075, 0.009, 0.062, 1, 1, 1), 'cockpit', dark);
      pad.position.copy(root);
      tube(
        [
          root.clone().add(V(0.022, 0, 0)),
          root.clone().add(V(0.2, 0.025, 0)),
          root.clone().add(V(0.245, 0.082, 0)),
        ],
        19,
        19,
        'cockpit',
        dark,
        1,
        1,
      );
    }
  }
  // Tire envelopes are visual references, not clearance certification.
  if (!ghost) {
    group.add(tireGroup, guideGroup);
    for (const axle of [p.rear, p.front]) {
      const radius = 0.311 + s.tire / 2000;
      const tireMat = new THREE.MeshStandardMaterial({
        color: '#99b6a2',
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        roughness: 0.9,
      });
      usedMaterials.add(tireMat);
      const tire = add(
        new THREE.TorusGeometry(radius, s.tire / 2000, 12, 112),
        'clearance',
        tireMat,
        tireGroup,
      );
      tire.position.copy(axle);
      const edge = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          Array.from({ length: 128 }, (_, i) =>
            V(
              Math.cos((i / 128) * Math.PI * 2) * (radius + s.tire / 2000),
              Math.sin((i / 128) * Math.PI * 2) * (radius + s.tire / 2000),
            ),
          ),
        ),
        new THREE.LineBasicMaterial({ color: '#6f9180', transparent: true, opacity: 0.28 }),
      );
      edge.position.copy(axle);
      tireGroup.add(edge);
    }
    function line(points: THREE.Vector3[], color: string) {
      guideGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }),
        ),
      );
    }
    const z = 0.08,
      x = -0.055,
      top = p.head.y;
    line([V(0, 0, z), V(x, 0, z), V(x, top, z), V(0, top, z)], '#dbef8c');
    line([V(0, top + 0.045, z), V(p.head.x, top + 0.045, z)], '#dbef8c');
    for (const y of [0, top]) line([V(x - 0.012, y, z), V(x + 0.012, y, z)], '#dbef8c');
    for (const a of [0, p.head.x]) line([V(a, top, z), V(a, top + 0.06, z)], '#dbef8c');
  }
  const labels = [
    { id: 'stack', text: `STACK ${study.geometry.stack}`, point: V(-0.085, p.head.y * 0.55, 0.1) },
    {
      id: 'reach',
      text: `REACH ${study.geometry.reach}`,
      point: V(p.head.x / 2, p.head.y + 0.084, 0.1),
    },
    { id: 'bb', text: '五通原点', point: V(0, -0.053, 0.1) },
  ];
  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>(),
      mats = new Set(usedMaterials);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        geometries.add(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
      }
    });
    geometries.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }
  return { group, meshes, tireGroup, guideGroup, labels, dispose, points: p };
}
