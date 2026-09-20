import * as THREE from 'three';
export type Study = 'ratchet' | 'rim';
export function buildStructure(kind: Study, hooked: boolean) {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: '#aab6ba',
    metalness: 0.96,
    roughness: 0.25,
  });
  const shell = new THREE.MeshStandardMaterial({
    color: '#263534',
    metalness: 0.85,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: '#cab27c',
    metalness: 0.84,
    roughness: 0.28,
  });
  const carbon = new THREE.MeshStandardMaterial({
    color: '#28302f',
    metalness: 0.3,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: '#161c1b',
    metalness: 0.02,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const bead = new THREE.MeshStandardMaterial({
    color: '#a7c367',
    metalness: 0.25,
    roughness: 0.48,
  });
  const fixed = new THREE.Group(),
    moving = new THREE.Group(),
    spring = new THREE.Group(),
    body = new THREE.Group();
  group.add(fixed, moving, spring, body);
  function mesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    parent: THREE.Group,
    part: string,
    z = 0,
  ) {
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z;
    m.userData.part = part;
    m.userData.casing = mat === shell && part !== 'axle';
    parent.add(m);
    return m;
  }
  function ring(
    outer: number,
    inner: number,
    depth: number,
    parent: THREE.Group,
    part: string,
    z: number,
    mat: THREE.Material = steel,
  ) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.35,
        bevelThickness: 0.35,
        curveSegments: 96,
      }),
      mat,
      parent,
      part,
      z,
    );
  }
  if (kind === 'ratchet') {
    ring(8, 5.2, 195, group, 'axle', -80, shell);
    ring(41, 35, 55, fixed, 'fixed', -57, shell);
    ring(43, 36, 4, fixed, 'fixed', -59, shell);
    ring(43, 36, 4, fixed, 'fixed', -8, shell);
    ring(33, 16, 8, fixed, 'fixed', -8);
    ring(15.7, 8, 7, fixed, 'bearing', -7, brass);
    ring(15.7, 8, 7, fixed, 'bearing', -55, brass);
    function teeth(parent: THREE.Group, part: string, facing: number) {
      const points: number[] = [];
      for (let t = 0; t < 36; t++) {
        const a = (t / 36) * Math.PI * 2 * facing,
          b = ((t + 0.94) / 36) * Math.PI * 2 * facing;
        const p = (r: number, angle: number, h: number) => [
          r * Math.cos(angle),
          r * Math.sin(angle),
          h * facing,
        ];
        const v = [p(18, a, 0), p(32, a, 0), p(32, b, 3), p(18, b, 3)];
        for (const i of [0, 1, 2, 0, 2, 3]) points.push(...v[i]);
        // Close the steep engagement face rather than floating decorative teeth.
        const end = [p(18, b, 0), p(32, b, 0), p(32, b, 3), p(18, b, 3)];
        for (const i of [0, 1, 2, 0, 2, 3]) points.push(...end[i]);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      geo.computeVertexNormals();
      const material = steel.clone();
      material.side = THREE.DoubleSide;
      mesh(geo, material, parent, part);
    }
    teeth(fixed, 'fixed', 1);
    ring(33, 16, 7, moving, 'moving', 0);
    teeth(moving, 'moving', -1);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const m = mesh(new THREE.BoxGeometry(2, 3, 6), steel, moving, 'moving', 3);
      m.position.x = Math.cos(a) * 33;
      m.position.y = Math.sin(a) * 33;
      m.rotation.z = a;
    }
    const helix = Array.from({ length: 361 }, (_, i) => {
      const a = (i / 360) * Math.PI * 2 * 5;
      return new THREE.Vector3(24 * Math.cos(a), 24 * Math.sin(a), (i / 360) * 22);
    });
    mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 360, 1.2, 10, false),
      steel,
      spring,
      'spring',
    );
    ring(29, 25.5, 50, body, 'body', 0, shell);
    ring(15.7, 8, 7, body, 'bearing', 42, brass);
    ring(28, 16, 4, body, 'body', 46, shell);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const m = mesh(new THREE.BoxGeometry(3, 3, 43), shell, body, 'body', 24);
      m.position.x = 29 * Math.cos(a);
      m.position.y = 29 * Math.sin(a);
      m.rotation.z = a;
    }
    ring(13, 6, 8, body, 'body', 53, steel);
  } else {
    const h = (hooked ? 21 : 25) / 2,
      // Top of the rim is y = 7; keep the full profile height equal to the published depth.
      depth = (hooked ? 51 : 40) - 7;
    const profile = new THREE.Shape();
    profile.moveTo(-h - 2, 7);
    profile.lineTo(-h - 3, 3);
    profile.lineTo(-h - 3, -9);
    profile.bezierCurveTo(-h - 3, -25, -8, -depth, 0, -depth);
    profile.bezierCurveTo(8, -depth, h + 3, -25, h + 3, -9);
    profile.lineTo(h + 3, 3);
    profile.lineTo(h + 2, 7);
    profile.lineTo(h, 7);
    if (hooked) {
      profile.lineTo(h - 1.6, 5.8);
      profile.lineTo(h - 1.6, 4);
    }
    profile.lineTo(h, 3);
    profile.lineTo(h, 0);
    profile.lineTo(h - 3, 0);
    profile.lineTo(h - 4, -3);
    profile.lineTo(-h + 4, -3);
    profile.lineTo(-h + 3, 0);
    profile.lineTo(-h, 0);
    profile.lineTo(-h, 3);
    if (hooked) {
      profile.lineTo(-h + 1.6, 4);
      profile.lineTo(-h + 1.6, 5.8);
    }
    profile.lineTo(-h, 7);
    profile.closePath();
    const hollow = new THREE.Path();
    hollow.moveTo(-h + 1, -7);
    hollow.bezierCurveTo(-h + 1, -22, -5, -depth + 3, 0, -depth + 3);
    hollow.bezierCurveTo(5, -depth + 3, h - 1, -22, h - 1, -7);
    hollow.lineTo(-h + 1, -7);
    profile.holes.push(hollow);
    const geo = new THREE.ExtrudeGeometry(profile, {
      depth: 90,
      bevelEnabled: false,
      curveSegments: 60,
    });
    mesh(geo, carbon, fixed, 'rim', -45);
    // Open tire casing section. Sidewalls and bead seats are illustrative, not a manufacturer CAD mold.
    const tire = new THREE.Shape();
    tire.moveTo(-h + 1, 2);
    tire.bezierCurveTo(-22, 18, -15, 33, 0, 34);
    tire.bezierCurveTo(15, 33, 22, 18, h - 1, 2);
    tire.lineTo(h - 2, 3);
    tire.bezierCurveTo(20, 18, 14, 31, 0, 32);
    tire.bezierCurveTo(-14, 31, -20, 18, -h + 2, 3);
    tire.closePath();
    mesh(
      new THREE.ExtrudeGeometry(tire, { depth: 90, bevelEnabled: false, curveSegments: 60 }),
      rubber,
      moving,
      'tire',
      -45,
    );
    for (const x of [-h + 1, h - 1]) {
      const m = mesh(new THREE.CylinderGeometry(1.6, 1.6, 90, 32), bead, moving, 'bead');
      m.rotation.x = Math.PI / 2;
      m.position.set(x, 3, 0);
    }
    // Visible section edge helps distinguish the casing from the hollow carbon rim.
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 25),
      new THREE.LineBasicMaterial({ color: '#94a593', transparent: true, opacity: 0.4 }),
    );
    edges.position.z = -45;
    fixed.add(edges);
  }
  return {
    group,
    update(explode: number, angle: number, coasting: boolean) {
      if (kind === 'ratchet') {
        fixed.rotation.z = coasting ? 0 : angle;
        moving.rotation.z = angle;
        body.rotation.z = angle;
        moving.position.z =
          3 +
          explode * 40 +
          (coasting && explode < 0.05
            ? ((angle % ((Math.PI * 2) / 36)) / ((Math.PI * 2) / 36)) * 3
            : 0);
        spring.position.z = 12 + explode * 70;
        body.position.z = 36 + explode * 105;
      } else {
        moving.position.y = explode * 32;
      }
    },
  };
}
