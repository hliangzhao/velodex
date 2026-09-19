import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Minus, Plus, RotateCcw, ScanLine } from 'lucide-react';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildBikeModel, modelProfiles } from './buildBikeModel';
import type { Bike, GeometrySize } from './types';

type Props = {
  bike: Bike;
  geometry: GeometrySize;
  selected: string;
  onSelect: (id: string) => void;
};
export default function Bike3D({ bike, geometry, selected, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef<{
    zoom: (factor: number) => void;
    reset: () => void;
    side: () => void;
  } | null>(null);
  const parts = useRef<THREE.Mesh[]>([]);
  const selection = useRef(selected);
  selection.current = selected;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [failed, setFailed] = useState(false);
  const [frameOnly, setFrameOnly] = useState(false);
  const onlyFrame = useRef(frameOnly);
  onlyFrame.current = frameOnly;
  const feature = modelProfiles[bike.id as keyof typeof modelProfiles]?.feature;
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor('#292d31');
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = new RoomEnvironment();
    const environmentMap = pmrem.fromScene(environment, 0.04);
    scene.environment = environmentMap.texture;
    scene.environmentIntensity = 0.75;
    environment.dispose();
    pmrem.dispose();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 30);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.minDistance = 0.65;
    controls.maxDistance = 5;
    controls.maxPolarAngle = Math.PI * 0.54;
    const fitDistance = () =>
      Math.max(
        1.14 / (2 * Math.tan((16 * Math.PI) / 180)),
        1.95 / (2 * Math.tan((16 * Math.PI) / 180) * camera.aspect),
      );
    const reset = () => {
      controls.target.set(0.09, 0.52, 0);
      camera.position
        .copy(controls.target)
        .add(new THREE.Vector3(0.12, 0.06, 1).normalize().multiplyScalar(fitDistance()));
      controls.update();
    };
    const side = () => {
      controls.target.set(0.09, 0.52, 0);
      camera.position.copy(controls.target).add(new THREE.Vector3(0, 0, fitDistance()));
      controls.update();
    };
    const zoom = (factor: number) => {
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 0.65, 5));
      camera.position.copy(controls.target).add(offset);
      controls.update();
    };
    actions.current = { reset, zoom, side };
    scene.add(new THREE.HemisphereLight('#edf2ff', '#353a40', 0.8));
    const key = new THREE.DirectionalLight('#ffffff', 3.5);
    key.position.set(-1.5, 3.5, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -1.6;
    key.shadow.camera.right = 1.6;
    key.shadow.camera.top = 1.6;
    key.shadow.camera.bottom = -1.6;
    key.shadow.normalBias = 0.015;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#d4e3f5', 2);
    rim.position.set(1, 2, -2);
    scene.add(rim);
    const { group: model, meshes } = buildBikeModel(bike, geometry);
    scene.add(model);
    const selectMaterials = () => {
      for (const part of meshes) {
        const m = part.material as THREE.MeshStandardMaterial;
        const active = part.userData.part === selection.current;
        m.emissive.set(active ? '#cad4de' : '#000000');
        m.emissiveIntensity = active && selection.current !== 'frame' ? 0.13 : 0;
        part.visible = !onlyFrame.current || part.userData.part === 'frame';
      }
    };
    selectMaterials();
    parts.current = meshes;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.003;
    floor.receiveShadow = true;
    scene.add(floor);
    const V = (x: number, y: number) => new THREE.Vector3(x, y, 0);
    let previousFit = 0;
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const nextFit = fitDistance();
      if (previousFit)
        camera.position
          .sub(controls.target)
          .multiplyScalar(nextFit / previousFit)
          .add(controls.target);
      previousFit = nextFit;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    reset();
    let pointerStart = V(0, 0);
    const down = (e: PointerEvent) => {
      pointerStart = V(e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      if (pointerStart.distanceTo(V(e.clientX, e.clientY)) > 5) return;
      const r = el.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObjects(meshes.filter((m) => m.visible))[0];
      if (hit) selectRef.current(hit.object.userData.part);
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    const keydown = (e: KeyboardEvent) => {
      if (e.target !== el) return;
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'r', 'R'].includes(e.key)
      )
        e.preventDefault();
      if (e.key === '+' || e.key === '=') zoom(0.85);
      if (e.key === '-') zoom(1.18);
      if (e.key.toLowerCase() === 'r') reset();
      if (e.key.startsWith('Arrow')) {
        const s = new THREE.Spherical().setFromVector3(
          camera.position.clone().sub(controls.target),
        );
        if (e.key === 'ArrowLeft') s.theta -= 0.12;
        if (e.key === 'ArrowRight') s.theta += 0.12;
        if (e.key === 'ArrowUp') s.phi -= 0.12;
        if (e.key === 'ArrowDown') s.phi += 0.12;
        s.phi = THREE.MathUtils.clamp(s.phi, 0.1, Math.PI * 0.9);
        camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(controls.target));
        controls.update();
      }
    };
    el.addEventListener('keydown', keydown);
    let visible = true;
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    intersection.observe(el);
    renderer.setAnimationLoop(() => {
      if (!visible || document.hidden) return;
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      intersection.disconnect();
      controls.dispose();
      el.removeEventListener('keydown', keydown);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((m) => m.dispose());
        }
      });
      environmentMap.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      parts.current = [];
      actions.current = null;
    };
  }, [bike.id, geometry]);
  useEffect(() => {
    for (const part of parts.current) {
      const m = part.material as THREE.MeshStandardMaterial;
      m.emissive.set(part.userData.part === selected ? '#cad4de' : '#000000');
      m.emissiveIntensity = part.userData.part === selected && selected !== 'frame' ? 0.13 : 0;
      part.visible = !frameOnly || part.userData.part === 'frame';
    }
  }, [selected, frameOnly]);
  return (
    <div className="three-view">
      <div
        ref={host}
        className="three-canvas"
        role="img"
        aria-label={`${bike.family} 车型 3D，可使用方向键旋转，加减键缩放，R 键复位`}
        tabIndex={0}
      />
      {failed && <div className="three-error">当前浏览器无法启用 3D，请切回整车实拍。</div>}
      <div className="three-caption">
        <strong>
          {bike.family} · {geometry.size} 码 · 素色重建
        </strong>
        <span>{feature}</span>
      </div>
      <div className="three-bottom-hint">拖拽旋转 · 滚轮 / 双指缩放 · 点击部件</div>
      <div className="three-actions">
        <button
          className="frame-toggle"
          aria-pressed={frameOnly}
          onClick={() => setFrameOnly(!frameOnly)}
        >
          {frameOnly ? '显示整车' : '仅看车架'}
        </button>
        <button aria-label="3D 正侧视图" title="正侧视图" onClick={() => actions.current?.side()}>
          <ScanLine size={17} />
        </button>
        <button aria-label="放大 3D" onClick={() => actions.current?.zoom(0.8)}>
          <Plus size={18} />
        </button>
        <button aria-label="缩小 3D" onClick={() => actions.current?.zoom(1.25)}>
          <Minus size={18} />
        </button>
        <button aria-label="复位 3D" onClick={() => actions.current?.reset()}>
          <RotateCcw size={17} />
        </button>
      </div>
    </div>
  );
}
