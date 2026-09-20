import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Bike, GeometrySize } from './types';
import profiles from './data/model-profiles.json';

// These are photo-derived surface estimates, not manufacturer CAD dimensions.
export const modelProfiles = profiles;
type Profile = (typeof profiles)[keyof typeof profiles] & {
  chainringTeeth?: number[];
  cassette?: { speeds: number; smallest: number; largest: number };
  barFlare?: number;
  stemLength?: number;
  forkMounts?: boolean;
  topTubeMounts?: boolean;
  storage?: boolean;
};
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
type Section = [number, number, number]; // curve position, silhouette depth, lateral width (metres)

/** Sweep a rounded, flattened section with varying width along a 3D centreline. */
function loft(points: THREE.Vector3[], sections: Section[], round = 0.62) {
  const curve = new THREE.CatmullRomCurve3(points);
  const n = 40,
    radial = 24,
    positions: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      center = curve.getPoint(t),
      tangent = curve.getTangent(t);
    const normal = V(-tangent.y, tangent.x, 0).normalize();
    const across = tangent.clone().cross(normal).normalize();
    const next = sections.findIndex((s) => s[0] >= t);
    const upper = sections[Math.max(1, next)],
      lower = sections[Math.max(0, next - 1)];
    const u = (t - lower[0]) / (upper[0] - lower[0]);
    const d = THREE.MathUtils.lerp(lower[1], upper[1], u) / 2;
    const w = THREE.MathUtils.lerp(lower[2], upper[2], u) / 2;
    for (let j = 0; j <= radial; j++) {
      const angle = (j / radial) * Math.PI * 2,
        c = Math.cos(angle),
        s = Math.sin(angle);
      const p = center
        .clone()
        .addScaledVector(normal, Math.sign(c) * Math.abs(c) ** round * d)
        .addScaledVector(across, Math.sign(s) * Math.abs(s) ** round * w);
      positions.push(p.x, p.y, p.z);
      if (i < n && j < radial) {
        const a = i * (radial + 1) + j,
          b = a + radial + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  for (const row of [0, n]) {
    const center = curve.getPoint(row / n),
      index = positions.length / 3;
    positions.push(center.x, center.y, center.z);
    for (let j = 0; j < radial; j++) {
      const a = row * (radial + 1) + j;
      indices.push(...(row === 0 ? [index, a + 1, a] : [index, a, a + 1]));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** One continuous shell gives the main triangle smooth moulded junctions. */
function frameShell(points: THREE.Vector3[], depths: number[], widths: number[], openSeat = false) {
  const count = points.length;
  function intersection(a: THREE.Vector3, da: THREE.Vector3, b: THREE.Vector3, db: THREE.Vector3) {
    const cross = da.x * db.y - da.y * db.x;
    if (Math.abs(cross) < 1e-5) return a.clone().lerp(b, 0.5);
    const delta = b.clone().sub(a),
      t = (delta.x * db.y - delta.y * db.x) / cross;
    return a.clone().addScaledVector(da, t);
  }
  function offset(sign: number) {
    return points.map((p, i) => {
      const prev = (i + count - 1) % count,
        next = (i + 1) % count;
      const a = p.clone().sub(points[prev]).normalize(),
        b = points[next].clone().sub(p).normalize();
      const leftA = V(-a.y, a.x).multiplyScalar(sign * Math.max(0.004, depths[prev] / 2 - 0.005)),
        leftB = V(-b.y, b.x).multiplyScalar(sign * Math.max(0.004, depths[i] / 2 - 0.005));
      if (openSeat && i === 0) return p.clone().add(leftB);
      if (openSeat && i === count - 1) return p.clone().add(leftA);
      return intersection(p.clone().add(leftA), a, p.clone().add(leftB), b);
    });
  }
  function rounded(path: THREE.Shape | THREE.Path, pts: THREE.Vector3[], radius: number) {
    const corners = pts.map((p, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length],
        next = pts[(i + 1) % pts.length];
      const r = Math.min(radius, p.distanceTo(prev) * 0.25, p.distanceTo(next) * 0.25);
      return {
        p,
        a: p.clone().lerp(prev, r / p.distanceTo(prev)),
        b: p.clone().lerp(next, r / p.distanceTo(next)),
      };
    });
    path.moveTo(corners[0].b.x, corners[0].b.y);
    for (let j = 1; j <= corners.length; j++) {
      const c = corners[j % corners.length];
      path.lineTo(c.a.x, c.a.y);
      path.quadraticCurveTo(c.p.x, c.p.y, c.b.x, c.b.y);
    }
    path.closePath();
  }
  const outside = offset(1),
    inside = offset(-1),
    shape = new THREE.Shape();
  if (openSeat) rounded(shape, [...outside, ...inside.reverse()], 0.012);
  else {
    rounded(shape, outside, 0.012);
    const hole = new THREE.Path();
    rounded(hole, inside.reverse(), 0.043);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 4,
    curveSegments: 14,
  });
  geo.translate(0, 0, -0.012);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const q = V(pos.getX(i), pos.getY(i)).sub(points[0]);
    const u = points[count - 1].clone().sub(points[0]),
      v = points[count - 3].clone().sub(points[0]);
    const det = u.x * v.y - u.y * v.x;
    const alpha = (q.x * v.y - q.y * v.x) / det,
      beta = (u.x * q.y - u.y * q.x) / det;
    const width =
      widths[count - 1] +
      alpha * (widths[count - 2] - widths[count - 1]) +
      beta * (widths[count - 3] - widths[count - 1]);
    pos.setZ(i, (pos.getZ(i) * THREE.MathUtils.clamp(width, 0.023, 0.052)) / 0.036);
  }
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const smooth = mergeVertices(geo, 0.00001);
  geo.dispose();
  smooth.computeVertexNormals();
  return smooth;
}

export function buildBikeModel(bike: Bike, g: GeometrySize) {
  const p: Profile = profiles[bike.id as keyof typeof profiles];
  if (!p) throw new Error(`No reconstructed profile for ${bike.id}`);
  const special = 'special' in p ? p.special : '';
  const isTT = special === 'tt' || special === 'tt-disc';
  const isGravel = bike.kind === '砾石公路';
  const group = new THREE.Group(),
    meshes: THREE.Mesh[] = [];
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const carbon = '#737b82',
    dark = '#24282b',
    metal = '#a3a7a9',
    rubber = '#17191b';
  function add(
    geo: THREE.BufferGeometry,
    part = 'frame',
    color = carbon,
    pos = V(0, 0),
    roughness = 0.31,
    metallic = 0.5,
  ) {
    const key = `${part}/${color}/${roughness}/${metallic}`;
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshPhysicalMaterial({
          color,
          roughness,
          metalness: metallic,
          clearcoat: part === 'frame' ? 0.3 : 0.1,
          clearcoatRoughness: 0.3,
        }),
      );
    const obj = new THREE.Mesh(geo, materials.get(key)!);
    obj.position.copy(pos);
    obj.userData.part = part;
    obj.castShadow = true;
    obj.receiveShadow = true;
    group.add(obj);
    meshes.push(obj);
    return obj;
  }
  function sweep(
    points: THREE.Vector3[],
    depth: number,
    width: number,
    part = 'frame',
    color = carbon,
    shape = 0.62,
    end = 1,
    bulge = 1,
  ) {
    return add(
      loft(
        points,
        [
          [0, depth, width],
          [0.18, depth * bulge, width],
          [0.8, depth, width],
          [1, depth * end, width * end],
        ],
        shape,
      ),
      part,
      color,
    );
  }
  function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, part: string, color = dark) {
    const obj = add(
      new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10),
      part,
      color,
      a.clone().add(b).multiplyScalar(0.5),
    );
    obj.quaternion.setFromUnitVectors(V(0, 1), b.clone().sub(a).normalize());
    return obj;
  }
  function disk(
    inner: number,
    outer: number,
    depth: number,
    pos: THREE.Vector3,
    part: string,
    color = metal,
  ) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return add(
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 64 }),
      part,
      color,
      pos.clone().add(V(0, 0, -depth / 2)),
    );
  }
  function cog(
    teeth: number,
    radius: number,
    inner: number,
    pos: THREE.Vector3,
    part: string,
    color = metal,
    depth = 0.002,
  ) {
    const shape = new THREE.Shape();
    for (let i = 0; i <= teeth * 4; i++) {
      const a = (i / (teeth * 4)) * Math.PI * 2,
        r = radius - (i % 4 < 2 ? 0.0022 : 0);
      if (!i) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return add(
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 40 }),
      part,
      color,
      pos.clone().add(V(0, 0, -depth / 2)),
    );
  }
  const tireWidth = p.tire / 1000,
    wheelRadius = 0.311 + tireWidth;
  const bb = V(0, wheelRadius - g.bbDrop / 1000);
  const rear = V(-Math.sqrt(g.chainstay ** 2 - g.bbDrop ** 2) / 1000, wheelRadius);
  // Dogma's selected official size table omits wheelbase: approximate for display only.
  const front = V(rear.x + (g.wheelbase ?? 985) / 1000, wheelRadius);
  const headDirection = V(
    Math.cos((g.headAngle * Math.PI) / 180),
    -Math.sin((g.headAngle * Math.PI) / 180),
  );
  const ht = V(g.reach / 1000, bb.y + g.stack / 1000);
  const hb = ht.clone().addScaledVector(headDirection, g.headTube / 1000);
  const sd = V(-Math.cos((g.seatAngle * Math.PI) / 180), Math.sin((g.seatAngle * Math.PI) / 180));
  const seatLength = (g.seatTube ?? p.seatLength + (g.stack - p.referenceStack) * 0.95) / 1000;
  const seat = bb.clone().addScaledVector(sd, seatLength);
  const saddle = bb.clone().addScaledVector(sd, seatLength + 0.18);
  const stayJoin = seat.clone().addScaledVector(sd, -p.stayDrop / 1000);
  const dt = p.downDepth / 1000,
    dw = p.downWidth / 1000;
  const topHead = ht.clone().addScaledVector(headDirection, 0.012);
  const downHead = hb.clone().addScaledVector(headDirection, -0.012);
  const topMid = seat
    .clone()
    .lerp(topHead, 0.55)
    .add(V(0, p.topBow / 1000));
  add(
    frameShell(
      [seat, topMid, topHead, downHead, bb],
      [p.topDepth / 1000, p.topDepth / 1000, p.headDepth / 1000, dt, p.seatDepth / 1000],
      [0.032, 0.033, 0.047, dw, p.seatWidth / 1000],
      special === 'isoflow' || special === 'y1',
    ),
  );

  if (special === 'y1') {
    // The photo-derived DEFY junction bends toward the rear before joining the top tube.
    const junction = stayJoin.clone().add(V(0.028, 0.005));
    sweep([bb, bb.clone().lerp(junction, 0.65), junction], 0.046, 0.026, 'frame', carbon, 0.6);
    sweep(
      [junction, seat.clone().add(V(0.028, -0.015)), seat],
      0.032,
      0.024,
      'frame',
      carbon,
      0.65,
    );
  }
  if (special === 'isoflow') {
    // Two side rails leave the seat-tube opening genuinely hollow in 3D.
    const lower = seat.clone().addScaledVector(sd, -0.125);
    sweep([bb, lower], 0.043, 0.03, 'frame', carbon, 0.7, 0.7);
    const rearLip = seat.clone().add(V(-0.025, -0.011));
    for (const sign of [-1, 1]) {
      sweep(
        [
          lower.clone().add(V(0, 0, sign * 0.019)),
          lower
            .clone()
            .lerp(seat, 0.6)
            .add(V(0.038, 0, sign * 0.023)),
          seat.clone().add(V(0.052, -0.002, sign * 0.024)),
        ],
        0.018,
        0.012,
      );
      sweep(
        [
          seat.clone().addScaledVector(sd, 0.055),
          rearLip,
          seat.clone().add(V(0.105, 0.008, sign * 0.009)),
        ],
        0.031,
        0.021,
      );
    }
  }
  const postStart = special === 'isoflow' ? seat.clone().addScaledVector(sd, 0.026) : seat;
  const postMid = postStart
    .clone()
    .lerp(saddle, 0.65)
    .add(V(special === 'onda' ? -0.012 : 0, 0));
  sweep(
    [postStart, postMid, saddle],
    p.postDepth / 1000,
    p.postWidth / 1000,
    'frame',
    special === 'seatmast' ? carbon : dark,
    special === 'round' || special === 'storage' ? 1 : 0.7,
    0.88,
  );
  if (special === 'seatmast')
    sweep([saddle.clone().addScaledVector(sd, -0.045), saddle], 0.041, 0.029, 'frame', dark, 0.7);
  if (special === 'round' || special === 'storage')
    sweep(
      [seat.clone().addScaledVector(sd, 0.008), seat.clone().addScaledVector(sd, 0.017)],
      0.034,
      0.034,
      'frame',
      dark,
      1,
    );
  for (const sign of [-1, 1]) {
    const dropout = rear.clone().add(V(0, 0, 0.066 * sign));
    const csStart = bb.clone().add(V(0, 0, 0.036 * sign));
    sweep(
      [
        csStart,
        csStart
          .clone()
          .lerp(dropout, 0.35)
          .add(V(0, -0.007, 0.017 * sign)),
        dropout,
      ],
      0.03,
      0.019,
      'frame',
      carbon,
      0.7,
      0.45,
    );
    const join = (special === 'isoflow' ? seat.clone().add(V(0.052, -0.048)) : stayJoin).add(
      V(0, 0, 0.023 * sign),
    );
    sweep(
      [
        join,
        join
          .clone()
          .lerp(dropout, 0.55)
          .add(V(-0.006, 0, 0.015 * sign)),
        dropout,
      ],
      p.stayDepth / 1000,
      0.013,
      'frame',
      carbon,
      0.8,
      0.65,
    );
    const crown = hb
      .clone()
      .addScaledVector(headDirection, 0.018)
      .add(V(0, 0, 0.032 * sign));
    const axle = front.clone().add(V(0, 0, 0.05 * sign));
    const forkMid = crown
      .clone()
      .lerp(axle, 0.58)
      .add(V(p.forkCurve / 1000, 0, 0.013 * sign));
    sweep(
      [crown, forkMid, axle],
      p.forkDepth / 1000,
      p.forkWidth / 1000,
      'frame',
      carbon,
      0.62,
      0.38,
    );
    disk(0.006, 0.012, 0.008, axle.clone().add(V(0, 0, sign * 0.003)), 'frame', dark);
  }
  sweep(
    [
      hb.clone().addScaledVector(headDirection, 0.01),
      hb.clone().addScaledVector(headDirection, 0.028),
    ],
    (p.headDepth / 1000) * 0.96,
    0.072,
    'frame',
    carbon,
    0.65,
  );
  rod(bb.clone().add(V(0, 0, -0.038)), bb.clone().add(V(0, 0, 0.038)), 0.029, 'frame', dark);

  if (special === 'external-fork') {
    const nose = sweep(
      [hb.clone().add(V(0.037, -0.018)), ht.clone().add(V(0.037, -0.003))],
      0.025,
      0.033,
      'frame',
      carbon,
      0.55,
    );
    nose.userData.structure = 'external-fork';
  }
  if (p.forkMounts) {
    for (const sign of [-1, 1]) {
      const crown = hb.clone().add(V(0, 0, sign * 0.032));
      const axle = front.clone().add(V(0, 0, sign * 0.05));
      for (const t of [0.32, 0.49, 0.66]) {
        const boss = disk(
          0.002,
          0.005,
          0.003,
          crown
            .clone()
            .lerp(axle, t)
            .add(V(0, 0, sign * 0.012)),
          'frame',
          dark,
        );
        boss.userData.structure = 'fork-mount';
      }
    }
  }
  if (p.topTubeMounts) {
    for (const t of [0.72, 0.87]) {
      const boss = add(
        new THREE.CylinderGeometry(0.004, 0.004, 0.004, 10),
        'frame',
        dark,
        seat
          .clone()
          .lerp(topHead, t)
          .add(V(0, p.topDepth / 2000 + 0.003)),
      );
      boss.userData.structure = 'top-tube-mount';
    }
  }

  // Slim, shaped saddle shell; rails and clamp remain distinct from the frame.
  const saddleShape = new THREE.Shape();
  saddleShape.moveTo(-0.118, -0.052);
  saddleShape.bezierCurveTo(-0.145, -0.084, -0.1, -0.08, -0.052, -0.053);
  saddleShape.bezierCurveTo(0.006, -0.017, 0.075, -0.016, 0.122, -0.014);
  saddleShape.quadraticCurveTo(0.14, 0, 0.122, 0.014);
  saddleShape.bezierCurveTo(0.075, 0.016, 0.006, 0.017, -0.052, 0.053);
  saddleShape.bezierCurveTo(-0.1, 0.08, -0.145, 0.084, -0.118, -0.052);
  const seatMesh = add(
    new THREE.ExtrudeGeometry(saddleShape, {
      depth: 0.007,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 3,
      curveSegments: 20,
    }),
    'frame',
    dark,
    saddle.clone().add(V(0.014, 0.026)),
  );
  seatMesh.rotation.x = Math.PI / 2;
  for (const sign of [-1, 1])
    sweep(
      [
        saddle.clone().add(V(-0.072, 0.022, sign * 0.025)),
        saddle.clone().add(V(-0.008, -0.012, sign * 0.018)),
        saddle.clone().add(V(0.06, 0.024, sign * 0.018)),
      ],
      0.006,
      0.006,
      'frame',
      metal,
      1,
    );

  // True rim volume with a rounded aero cross-section, rather than a flat disk.
  for (const [wheelIndex, center] of [rear, front].entries()) {
    const depth = (wheelIndex ? p.rimFront : p.rimRear) / 1000,
      outer = 0.313,
      inner = outer - depth;
    const rimSection = [
      [inner, -0.007],
      [inner + 0.004, -0.011],
      [outer - 0.015, -0.0145],
      [outer, -0.014],
      [outer, 0.014],
      [outer - 0.015, 0.0145],
      [inner + 0.004, 0.011],
      [inner, 0.007],
      [inner, -0.007],
    ].map(([r, z]) => new THREE.Vector2(r, z));
    const rim = add(new THREE.LatheGeometry(rimSection, 128), 'wheels', dark, center, 0.35, 0.45);
    rim.rotation.x = Math.PI / 2;
    add(
      new THREE.TorusGeometry(0.311 + tireWidth * 0.51, tireWidth * 0.49, 18, 128),
      'tires',
      rubber,
      center,
      0.82,
      0.02,
    );
    if (isGravel) {
      // Small shoulder knobs distinguish gravel tires without hundreds of draw calls.
      const tread = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.006, 0.003, 0.006),
        new THREE.MeshStandardMaterial({ color: rubber, roughness: 0.95 }),
        192,
      );
      const stamp = new THREE.Object3D();
      for (let i = 0; i < 192; i++) {
        const a = (Math.floor(i / 2) / 96) * Math.PI * 2;
        stamp.position
          .copy(center)
          .add(
            V(
              Math.cos(a) * (wheelRadius - 0.003),
              Math.sin(a) * (wheelRadius - 0.003),
              (i % 2 ? 1 : -1) * tireWidth * 0.23,
            ),
          );
        stamp.rotation.z = a - Math.PI / 2;
        stamp.updateMatrix();
        tread.setMatrixAt(i, stamp.matrix);
      }
      tread.userData.part = 'tires';
      tread.userData.structure = 'gravel-tread';
      group.add(tread);
      meshes.push(tread);
    }
    for (const side of [-1, 1])
      add(
        new THREE.TorusGeometry(0.314, 0.001, 5, 128),
        'tires',
        '#484747',
        center.clone().add(V(0, 0, side * tireWidth * 0.43)),
        0.85,
        0.05,
      );
    const solidRear = special === 'tt-disc' && wheelIndex === 0;
    if (solidRear) {
      const cover = add(
        new THREE.CylinderGeometry(0.306, 0.306, 0.017, 128),
        'wheels',
        '#33393e',
        center,
        0.44,
        0.3,
      );
      cover.rotation.x = Math.PI / 2;
      cover.userData.structure = 'rear-disc';
    }
    for (let i = 0; i < (solidRear ? 0 : p.spokes); i++) {
      const a = (i / p.spokes) * Math.PI * 2,
        sign = i % 2 ? 1 : -1,
        hubAngle = a + (i % 4 < 2 ? 0.33 : -0.33);
      const start = center
        .clone()
        .add(V(Math.cos(hubAngle) * 0.023, Math.sin(hubAngle) * 0.023, sign * 0.03));
      const end = center
        .clone()
        .add(V(Math.cos(a) * (inner + 0.004), Math.sin(a) * (inner + 0.004), sign * 0.002));
      rod(start, end, 0.00085, 'wheels', '#656a6d');
    }
    rod(
      center.clone().add(V(0, 0, -0.049)),
      center.clone().add(V(0, 0, 0.049)),
      0.014,
      'wheels',
      dark,
    );
    for (const side of [-1, 1])
      disk(0.007, 0.025, 0.003, center.clone().add(V(0, 0, side * 0.03)), 'wheels', dark);
    rod(
      center.clone().add(V(0.0, -outer, 0.0)),
      center.clone().add(V(0.0, -outer + 0.024, 0.0)),
      0.0022,
      'wheels',
      metal,
    );
    const rotor = new THREE.Shape();
    rotor.absarc(0, 0, 0.08, 0, Math.PI * 2, false);
    const hubHole = new THREE.Path();
    hubHole.absarc(0, 0, 0.018, 0, Math.PI * 2, true);
    rotor.holes.push(hubHole);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const h = new THREE.Path();
      h.absellipse(Math.cos(a) * 0.057, Math.sin(a) * 0.057, 0.015, 0.006, 0, Math.PI * 2, true, a);
      rotor.holes.push(h);
    }
    add(
      new THREE.ExtrudeGeometry(rotor, { depth: 0.0018, bevelEnabled: false, curveSegments: 48 }),
      'wheels',
      metal,
      center.clone().add(V(0, 0, -0.044)),
      0.32,
      0.85,
    );
    sweep(
      [center.clone().add(V(-0.038, 0.036, -0.05)), center.clone().add(V(-0.055, 0.064, -0.05))],
      0.025,
      0.027,
      'shifters',
      dark,
      0.5,
    );
  }

  const rings = bb.clone().add(V(0, 0, 0.054));
  const bigTeeth =
    p.chainringTeeth?.[0] ??
    (['cervelo-r5', 'teammachine-r01'].includes(bike.id)
      ? 48
      : bike.id === 'vanrysel-edr-cf'
        ? 50
        : ['cervelo-s5', 'propel-sl0', 'speedmax-cfr-tt'].includes(bike.id)
          ? 54
          : 52);
  const smallTeeth = p.chainringTeeth ? p.chainringTeeth[1] : 36;
  const bigR = (bigTeeth * 0.0127) / (2 * Math.PI),
    smallR = ((smallTeeth ?? 36) * 0.0127) / (2 * Math.PI);
  cog(bigTeeth, bigR, bigR - 0.012, rings, 'chainrings', metal, 0.003).userData.structure =
    'outer-chainring';
  if (smallTeeth)
    cog(
      smallTeeth,
      smallR,
      smallR - 0.009,
      rings.clone().add(V(0, 0, -0.008)),
      'chainrings',
      dark,
      0.002,
    ).userData.structure = 'inner-chainring';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.55;
    const end = rings
      .clone()
      .add(V(Math.cos(a) * (bigR - 0.006), Math.sin(a) * (bigR - 0.006), 0.001));
    sweep([rings, end], 0.015, 0.008, 'chainrings', dark, 0.5, 0.7);
  }
  disk(0.008, 0.025, 0.012, rings, 'crank', dark);
  for (const side of [-1, 1]) {
    const root = bb.clone().add(V(0, 0, side * 0.072));
    const tip = root.clone().add(V(side * 0.166, side * -0.039));
    sweep([root, root.clone().lerp(tip, 0.4), tip], 0.032, 0.017, 'crank', dark, 0.6, 0.65);
    disk(0.005, 0.009, 0.004, tip.clone().add(V(0, 0, side * 0.012)), 'crank', metal);
  }
  if (bike.hasPowerMeter)
    disk(0.007, 0.021, 0.005, rings.clone().add(V(0, 0, 0.035)), 'power', '#41474b');
  const cassetteCenter = rear.clone().add(V(0, 0, 0.042));
  const cassette = p.cassette ?? { speeds: 12, smallest: 11, largest: 34 };
  for (let i = 0; i < cassette.speeds; i++) {
    // End sprockets and speed count are published; intermediate spacing is illustrative.
    const teeth = Math.round(
      cassette.largest - ((cassette.largest - cassette.smallest) * i) / (cassette.speeds - 1),
    );
    const sprocket = cog(
      teeth,
      (teeth * 0.0127) / (2 * Math.PI),
      0.016,
      cassetteCenter.clone().add(V(0, 0, i * 0.0036)),
      'cassette',
      metal,
      0.0016,
    );
    sprocket.userData.structure = 'cassette-sprocket';
  }
  const upper = rear.clone().add(V(0.026, -0.067, 0.078)),
    lower = rear.clone().add(V(0.04, -0.17, 0.078));
  sweep([rear.clone().add(V(0.015, -0.018, 0.073)), upper], 0.039, 0.025, 'cassette', dark, 0.6);
  sweep([upper, lower], 0.024, 0.006, 'cassette', dark, 0.6);
  cog(12, 0.023, 0.01, upper, 'cassette', dark, 0.009);
  cog(14, 0.027, 0.01, lower, 'cassette', dark, 0.009);
  const chainPoints = [
    rings.clone().add(V(0, bigR, 0.004)),
    rear.clone().add(V(-0.007, 0.044, 0.078)),
    rear.clone().add(V(-0.046, -0.007, 0.078)),
    upper,
    lower.clone().add(V(-0.016, -0.018)),
    rings.clone().add(V(0, -bigR, 0.004)),
  ];
  const chainCurve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < chainPoints.length; i++)
    chainCurve.add(new THREE.LineCurve3(chainPoints[i], chainPoints[(i + 1) % chainPoints.length]));
  const links = Math.ceil(chainCurve.getLength() / 0.0127),
    chainGeo = new THREE.BoxGeometry(0.0085, 0.0035, 0.0055);
  const chain = new THREE.InstancedMesh(
    chainGeo,
    new THREE.MeshStandardMaterial({ color: metal, metalness: 0.8, roughness: 0.32 }),
    links,
  );
  chain.userData.part = 'chainrings';
  const transform = new THREE.Object3D();
  for (let i = 0; i < links; i++) {
    const t = i / links;
    transform.position.copy(chainCurve.getPoint(t));
    transform.quaternion.setFromUnitVectors(V(1, 0), chainCurve.getTangent(t).normalize());
    transform.updateMatrix();
    chain.setMatrixAt(i, transform.matrix);
  }
  group.add(chain);
  meshes.push(chain);
  if (smallTeeth)
    sweep(
      [bb.clone().add(V(-0.015, 0.115, 0.042)), bb.clone().add(V(0.035, 0.1, 0.057))],
      0.021,
      0.016,
      'shifters',
      dark,
      0.6,
    ).userData.structure = 'front-derailleur';

  const stemRoot = ht.clone().addScaledVector(headDirection, -p.spacer / 1000);
  sweep([ht, stemRoot], 0.043, 0.035, 'frame', dark, 0.8);
  if (special === 'future-shock') {
    const boot = sweep([ht, stemRoot], 0.047, 0.041, 'frame', rubber, 0.85);
    boot.userData.structure = 'future-shock';
  }
  for (let i = 1; i < 4; i++)
    sweep(
      [
        ht.clone().lerp(stemRoot, i / 4),
        ht
          .clone()
          .lerp(stemRoot, i / 4)
          .addScaledVector(headDirection, 0.001),
      ],
      0.044,
      0.036,
      'frame',
      '#44484a',
      0.8,
    );
  const bar = stemRoot.clone().add(V((p.stemLength ?? 100) / 1000, 0.019));
  sweep([stemRoot, bar], special === 's5' ? 0.035 : 0.025, 0.032, 'shifters', dark, 0.5, 0.7);
  if (isTT) {
    // TT base bar, riser, elbow cups and extensions are distinct selectable surfaces.
    const riserTop = bar.clone().add(V(-0.014, special === 'tt' ? 0.105 : 0.078));
    sweep([bar, riserTop], 0.035, 0.055, 'shifters', carbon, 0.55);
    for (const sign of [-1, 1]) {
      const wing = bar.clone().add(V(0.012, -0.007, sign * 0.19));
      const baseBar = add(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            bar,
            bar.clone().add(V(-0.014, 0, sign * 0.1)),
            wing,
            wing.clone().add(V(0.07, 0.005)),
          ]),
          40,
          0.012,
          16,
          false,
        ),
        'shifters',
        dark,
      );
      baseBar.userData.structure = 'tt-basebar';
      sweep(
        [
          wing.clone().add(V(0.069, 0.003)),
          wing.clone().add(V(0.07, -0.055)),
          wing.clone().add(V(0.04, -0.066)),
        ],
        0.009,
        0.008,
        'shifters',
        dark,
        0.8,
      );
      const elbow = riserTop.clone().add(V(-0.028, 0, sign * 0.073));
      const pad = add(new THREE.BoxGeometry(0.095, 0.015, 0.07), 'shifters', rubber, elbow);
      pad.userData.structure = 'tt-elbow-pad';
      for (const side of [-1, 1]) {
        sweep(
          [
            elbow.clone().add(V(-0.047, 0.007, side * 0.036)),
            elbow.clone().add(V(0.043, 0.007, side * 0.036)),
          ],
          0.017,
          0.004,
          'shifters',
          carbon,
          0.8,
        );
      }
      const tip = elbow.clone().add(V(0.27, 0.09));
      const extension = add(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            elbow.clone().add(V(-0.015, -0.018)),
            elbow.clone().add(V(0.115, -0.005)),
            elbow.clone().add(V(0.21, 0.018)),
            tip,
          ]),
          48,
          0.011,
          14,
          false,
        ),
        'shifters',
        dark,
      );
      extension.userData.structure = 'tt-extension';
      add(new THREE.SphereGeometry(0.012, 12, 8), 'shifters', '#4b5155', tip);
    }
  } else {
    // Aero top, compact drop and sculpted hood are separate geometries.
    const barPath = [
      bar.clone().add(V(0.02, -0.005, -0.19)),
      bar.clone().add(V(special === 'y1' ? -0.02 : 0, special === 'y1' ? -0.024 : 0, -0.12)),
      bar,
      bar.clone().add(V(special === 'y1' ? -0.02 : 0, special === 'y1' ? -0.024 : 0, 0.12)),
      bar.clone().add(V(0.02, -0.005, 0.19)),
    ];
    // A regular tube is appropriate here: unlike frame lofts the top runs across Z.
    add(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(barPath), 36, 0.013, 12, false),
      'shifters',
      dark,
    );
    for (const sign of [-1, 1]) {
      const z = sign * 0.19;
      const flare = Math.tan(((p.barFlare ?? 0) * Math.PI) / 180) * 0.13 * sign;
      const points = [
        bar.clone().add(V(0.02, -0.005, z)),
        bar.clone().add(V(0.083, -0.024, z)),
        bar.clone().add(V(0.103, -0.077, z + flare * 0.5)),
        bar.clone().add(V(0.066, -0.125, z + flare)),
        bar.clone().add(V(-0.017, -0.13, z + flare)),
      ];
      add(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 50, 0.0125, 12, false),
        'shifters',
        rubber,
        V(0, 0),
        0.85,
        0.03,
      );
      const hood = points[1].clone();
      sweep(
        [
          hood.clone().add(V(-0.03, 0.005)),
          hood.clone().add(V(0.026, 0.021)),
          hood.clone().add(V(0.045, 0.063)),
        ],
        0.028,
        0.03,
        'shifters',
        rubber,
        0.8,
        0.72,
      );
      sweep(
        [
          hood.clone().add(V(0.044, 0.047)),
          hood.clone().add(V(0.052, -0.006)),
          hood.clone().add(V(0.052, -0.071)),
          hood.clone().add(V(0.043, -0.084)),
        ],
        0.011,
        0.007,
        'shifters',
        dark,
        0.8,
        0.7,
      );
    }
  }
  if (special === 'storage' || p.storage) {
    const a = bb.clone().lerp(downHead, 0.48),
      b = bb.clone().lerp(downHead, 0.78);
    const normal = V(-(b.y - a.y), b.x - a.x).normalize();
    sweep(
      [a.addScaledVector(normal, dt * 0.5), b.addScaledVector(normal, dt * 0.5)],
      0.003,
      0.03,
      'frame',
      '#505659',
      0.5,
    );
  }
  return { group, meshes, feature: p.feature };
}
