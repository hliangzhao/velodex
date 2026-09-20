import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
type Section = [number, number, number];

/** Sweep a rounded, flattened section with varying width along a 3D centreline. */
export function loft(points: THREE.Vector3[], sections: Section[], round = 0.62) {
  const curve = new THREE.CatmullRomCurve3(points);
  const n = 40,
    radial = 24,
    positions: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      center = curve.getPoint(t),
      tangent = curve.getTangent(t);
    const normal = V(-tangent.y, tangent.x, 0);
    if (normal.lengthSq() < 1e-10) normal.set(0, 1, 0);
    normal.normalize();
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
export function frameShell(
  points: THREE.Vector3[],
  depths: number[],
  widths: number[],
  openSeat = false,
) {
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
