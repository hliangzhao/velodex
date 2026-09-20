import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildStructure, type Study } from './buildStructure';
const sources = {
  ratchet: 'https://www.dtswiss.com/en/wheels/wheels-technology/ratchet-exp-technology',
  rim: 'https://www.sram.com/en/service/models/wh-303-ftld-a1',
};
export default function StructureLab() {
  const [study, setStudy] = useState<Study>('ratchet'),
    [explode, setExplode] = useState(0.65),
    [hooked, setHooked] = useState(false),
    [cutaway, setCutaway] = useState(false),
    [frontView, setFrontView] = useState(false),
    [motion, setMotion] = useState<'paused' | 'drive' | 'coast'>('paused'),
    [selected, setSelected] = useState('moving'),
    [reset, setReset] = useState(0),
    [error, setError] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ explode, motion, selected, cutaway });
  live.current = { explode, motion, selected, cutaway };
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError(true);
      return;
    }
    setError(false);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor('#14211e');
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 3000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = study === 'rim' ? 75 : 150;
    controls.maxDistance = 900;
    const target = study === 'ratchet' ? new THREE.Vector3(0, 0, 55) : new THREE.Vector3(0, 8, 0);
    controls.target.copy(target);
    camera.position.copy(
      study === 'ratchet'
        ? new THREE.Vector3(230, 125, 305)
        : frontView
          ? new THREE.Vector3(0, 8, 260)
          : new THREE.Vector3(150, 100, 205),
    );
    const env = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const texture = pmrem.fromScene(env, 0.04);
    scene.environment = texture.texture;
    env.dispose();
    scene.add(new THREE.HemisphereLight('#dbeadf', '#1c3024', 2));
    const key = new THREE.DirectionalLight('#f0f7e5', 4);
    key.position.set(100, 180, 200);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#b7dce7', 3);
    rim.position.set(-150, 20, -100);
    scene.add(rim);
    const model = buildStructure(study, hooked);
    scene.add(model.group);
    const meshes: THREE.Mesh[] = [];
    model.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        meshes.push(o);
        o.userData.original = o.material;
        const mat = (o.material as THREE.MeshStandardMaterial).clone();
        o.material = mat;
      }
    });
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    observer.observe(el);
    let angle = 0,
      last = performance.now(),
      frame = 0,
      visible = true;
    const onVisibility = () => {
      visible = !document.hidden;
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible) return;
      const s = live.current;
      if (s.motion !== 'paused') angle += dt * 0.45;
      model.update(s.explode, angle, s.motion === 'coast');
      for (const m of meshes) {
        m.visible = !(m.userData.casing && s.cutaway);
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissive.set(m.userData.part === s.selected ? '#547628' : '#000000');
        mat.emissiveIntensity = 0.3;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);
    let down = { x: 0, y: 0 };
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObjects(meshes.filter((m) => m.visible))[0];
      if (hit) setSelected(hit.object.userData.part);
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      'aria-label',
      '3D 结构，可拖动旋转、滚轮缩放；方向键旋转，加减键缩放',
    );
    const keyboard = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(e.key))
        return;
      e.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      const s = new THREE.Spherical().setFromVector3(offset);
      if (e.key === 'ArrowLeft') s.theta -= 0.15;
      if (e.key === 'ArrowRight') s.theta += 0.15;
      if (e.key === 'ArrowUp') s.phi = Math.max(0.1, s.phi - 0.15);
      if (e.key === 'ArrowDown') s.phi = Math.min(Math.PI - 0.1, s.phi + 0.15);
      if (['+', '='].includes(e.key)) s.radius = Math.max(controls.minDistance, s.radius * 0.9);
      if (e.key === '-') s.radius = Math.min(controls.maxDistance, s.radius * 1.1);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
      controls.update();
    };
    renderer.domElement.addEventListener('keydown', keyboard);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      controls.dispose();
      model.group.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
          if (o.userData.original) o.userData.original.dispose();
        }
      });
      texture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [study, hooked, reset, frontView]);
  const facts =
    study === 'ratchet'
      ? [
          ['fixed', '01 / 固定端面齿环', 'EXP 将内侧齿环与螺纹环结合，固定在花鼓壳体一侧。'],
          [
            'moving',
            '02 / 浮动端面齿环',
            '踩踏时两片端面齿啮合；滑行时活动齿环沿轴向退让。本示例为 36 齿，每齿间隔 10°。',
          ],
          [
            'spring',
            '03 / 单圆柱弹簧',
            '单根弹簧把活动齿环推回啮合位置。拖动分解滑杆，观察它与齿环的顺序。',
          ],
          ['bearing', '04 / 轴承', '轴承支撑轴系。金色区域用于识别轴承位置，并非原厂轴承材质。'],
          [
            'body',
            '05 / 塔基壳体',
            '带动活动齿环转动。塔基花键与密封件已简化，不表示某一塔基接口。',
          ],
        ]
      : [
          [
            'rim',
            '01 / 碳轮圈截面',
            `${hooked ? '21 mm 有钩 / 51 mm 框高' : '25 mm 无钩 / 40 mm 框高'}。内宽与框高参考下方型号；壁厚、曲率和胎床形状用于解释原理。`,
          ],
          [
            'bead',
            '02 / 胎圈',
            '浅绿色圆条标示胎圈位置。它与轮圈胎圈座的匹配决定装配条件，不能仅凭有无内胎判断。',
          ],
          [
            'tire',
            '03 / 胎体',
            '分解后可看到胎体与胎圈的位置。显示的是局部直线截样，胎宽、胎压变形与碳布铺层不参与模拟。',
          ],
        ];
  return (
    <>
      <div className="work-actions">
        <button
          className={`light-button ${study === 'ratchet' ? 'selected' : ''}`}
          aria-pressed={study === 'ratchet'}
          onClick={() => {
            setStudy('ratchet');
            setCutaway(false);
            setFrontView(false);
            setSelected('moving');
            setExplode(0.65);
            setMotion('paused');
          }}
        >
          01 · Ratchet EXP 啮合
        </button>
        <button
          className={`light-button ${study === 'rim' ? 'selected' : ''}`}
          aria-pressed={study === 'rim'}
          onClick={() => {
            setStudy('rim');
            setCutaway(false);
            setSelected('rim');
            setExplode(0.15);
            setMotion('paused');
          }}
        >
          02 · 胎圈与轮圈截面
        </button>
      </div>
      <div className="lab-grid">
        <div className="lab-stage">
          <div ref={host} style={{ width: '100%', height: '100%' }} />
          {error && (
            <p className="lab-overlay">此设备无法启动 WebGL；右侧仍可阅读结构说明与原厂资料。</p>
          )}
          <span className="lab-overlay">
            拖拽旋转 · 滚轮 / 双指缩放 · 点击部件查看 · 方向键也可操作
          </span>
        </div>
        <section className="work-panel lab-controls">
          <div>
            <span className="eyebrow">STRUCTURE STUDY / {study === 'ratchet' ? '01' : '02'}</span>
            <h2>{study === 'ratchet' ? '啮合，发生在端面。' : '看见轮胎坐落的位置。'}</h2>
            <label>
              结构分解 · {Math.round(explode * 100)}%
              <input
                type="range"
                min="0"
                max="1"
                step=".01"
                value={explode}
                onChange={(e) => setExplode(+e.target.value)}
              />
            </label>
            {study === 'ratchet' ? (
              <div className="work-actions">
                {(
                  [
                    ['paused', '静止'],
                    ['drive', '踩踏啮合'],
                    ['coast', '滑行越齿'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    className={`light-button ${motion === id ? 'selected' : ''}`}
                    aria-pressed={motion === id}
                    key={id}
                    onClick={() => {
                      setMotion(id);
                      setExplode(0);
                      setCutaway(id !== 'paused');
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="work-actions">
                <button
                  className="light-button"
                  aria-pressed={!hooked}
                  onClick={() => setHooked(false)}
                >
                  303 Firecrest 尺寸 / 无钩
                </button>
                <button
                  className="light-button"
                  aria-pressed={hooked}
                  onClick={() => setHooked(true)}
                >
                  Rapide CLX III 前轮尺寸 / 有钩
                </button>
              </div>
            )}
            {study === 'ratchet' ? (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={cutaway}
                  onChange={(e) => setCutaway(e.target.checked)}
                />
                隐藏外壳，观察啮合
              </label>
            ) : (
              <button
                className="light-button"
                aria-pressed={frontView}
                onClick={() => setFrontView((v) => !v)}
              >
                {frontView ? '透视观察' : '截面正视'}
              </button>
            )}
            <button
              className="light-button"
              onClick={() => {
                setFrontView(false);
                setReset((x) => x + 1);
              }}
            >
              重置视角
            </button>
          </div>
          <div className="lab-facts">
            {facts.map(([id, title, text]) => (
              <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>
                <strong>
                  {title}
                  {selected === id ? ' ↖' : ''}
                </strong>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="work-panel">
        <strong>建模依据与精度</strong>
        <p>
          {study === 'ratchet'
            ? '参考 DT Swiss 官方 EXP 原理，保留固定齿环、活动齿环和单弹簧的关系；36 齿对应图鉴 ARC 1100 DICUT 的配置。部件外径、轴向距离、齿面坡度和外壳均为解释性建模，动画不模拟受力或磨损。'
            : '采用官方公布的轮圈内宽与框高作为尺度，其余截面形状为解释性建模。这是局部结构观察，不能用于判断实际轮胎是否可装，也不是轮圈 CAD。'}
        </p>
        <p className="work-note">
          这里把可核验的尺度与工作原理做成可观察的结构；不把模型当作原厂制造图或性能测试。
        </p>
        <a
          className="text-link"
          href={
            study === 'rim' && hooked
              ? 'https://www.specialized.com/us/en/roval-rapide-clx-iii/p/1000256237'
              : sources[study]
          }
          target="_blank"
          rel="noreferrer"
        >
          核对官方资料 ↗
        </a>
      </div>
    </>
  );
}
