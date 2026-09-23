import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { frameStudies, buildFrameStudy, type FrameStudy } from './buildFrameStudy';
import { base } from './SiteChrome';

type View = 'perspective' | 'side' | 'front';
function FrameViewer({
  study,
  reference,
  view,
  selected,
  onSelect,
  showWheels,
  showGuides,
  reset,
}: {
  study: FrameStudy;
  reference?: FrameStudy;
  view: View;
  selected: string;
  onSelect: (part: string) => void;
  showWheels: boolean;
  showGuides: boolean;
  reset: number;
}) {
  const host = useRef<HTMLDivElement>(null),
    annotations = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const live = useRef({ selected, onSelect, showWheels, showGuides });
  live.current = { selected, onSelect, showWheels, showGuides };
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(true);
      return;
    }
    setError(false);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor('#172721');
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50),
      controls = new OrbitControls(camera, renderer.domElement);
    const target = new THREE.Vector3(0.09, 0.26, 0);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minZoom = 0.6;
    controls.maxZoom = 4;
    camera.position
      .copy(target)
      .add(
        view === 'side'
          ? new THREE.Vector3(0, 0, 3)
          : view === 'front'
            ? new THREE.Vector3(3, 0, 0)
            : new THREE.Vector3(1.1, 0.62, 2.2),
      );
    camera.lookAt(target);
    const env = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(renderer),
      texture = pmrem.fromScene(env, 0.04);
    env.dispose();
    scene.environment = texture.texture;
    scene.add(new THREE.HemisphereLight('#e4eedf', '#233c2e', 2.2));
    const key = new THREE.DirectionalLight('#f8f5db', 3);
    key.position.set(-1, 3, 2);
    scene.add(key);
    const light = new THREE.DirectionalLight('#c2e0ee', 2);
    light.position.set(2, 1, -1);
    scene.add(light);
    const model = buildFrameStudy(study),
      ghost = reference ? buildFrameStudy(reference, true) : undefined;
    scene.add(model.group);
    if (ghost) scene.add(ghost.group);
    const originals = new Map<THREE.Mesh, THREE.Material>();
    for (const mesh of model.meshes) {
      originals.set(mesh, mesh.material as THREE.Material);
      mesh.material = (mesh.material as THREE.Material).clone();
    }
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      const aspect = w / h,
        span = Math.max(1.16, 1.85 / aspect);
      camera.left = (-span * aspect) / 2;
      camera.right = (span * aspect) / 2;
      camera.top = span / 2;
      camera.bottom = -span / 2;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let frame = 0,
      down = { x: 0, y: 0 };
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) return;
      const current = live.current;
      model.tireGroup.visible = current.showWheels;
      model.guideGroup.visible = current.showGuides;
      for (const mesh of model.meshes) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive?.set(mesh.userData.part === current.selected ? '#89ad4e' : '#000000');
        mat.emissiveIntensity = mesh.userData.part === current.selected ? 0.22 : 0;
        if (mesh.userData.part === 'clearance')
          mat.opacity = current.selected === 'clearance' ? 0.3 : 0.12;
      }
      controls.update();
      renderer.render(scene, camera);
      if (annotations.current)
        for (const label of model.labels) {
          const node = annotations.current.querySelector<HTMLElement>(
            `[data-measure="${label.id}"]`,
          );
          if (!node) continue;
          const p = label.point.clone().project(camera);
          node.style.transform = `translate(${(p.x * 0.5 + 0.5) * el.clientWidth}px,${(-p.y * 0.5 + 0.5) * el.clientHeight}px) translate(-50%,-50%)`;
          node.hidden = !current.showGuides || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
        }
    };
    tick();
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObjects(
        model.meshes.filter((m) => live.current.showWheels || m.userData.part !== 'clearance'),
      )[0];
      if (hit) live.current.onSelect(hit.object.userData.part);
    };
    const keyboard = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(e.key))
        return;
      e.preventDefault();
      if (['+', '-', '='].includes(e.key)) {
        camera.zoom = THREE.MathUtils.clamp(camera.zoom * (e.key === '-' ? 0.9 : 1.1), 0.6, 4);
        camera.updateProjectionMatrix();
      } else {
        const offset = camera.position.clone().sub(controls.target),
          s = new THREE.Spherical().setFromVector3(offset);
        if (e.key === 'ArrowLeft') s.theta -= 0.15;
        if (e.key === 'ArrowRight') s.theta += 0.15;
        if (e.key === 'ArrowUp') s.phi -= 0.15;
        if (e.key === 'ArrowDown') s.phi += 0.15;
        s.makeSafe();
        camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
      }
      controls.update();
    };
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      'aria-label',
      `${study.label}车架 3D：拖拽旋转，滚轮或加减键缩放，方向键旋转，点击结构查看说明`,
    );
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('keydown', keyboard);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('keydown', keyboard);
      model.dispose();
      originals.forEach((m) => m.dispose());
      ghost?.dispose();
      texture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [study, reference, view, reset]);
  return (
    <div className="frame-stage">
      <div ref={host} className="frame-canvas" />
      <div className="frame-annotations" ref={annotations} aria-hidden="true">
        <span data-measure="stack">STACK {study.geometry.stack}</span>
        <span data-measure="reach">REACH {study.geometry.reach}</span>
        <span data-measure="bb">五通原点</span>
      </div>
      <div className="frame-stage-label">
        <b>{study.english}</b>
        <span>类型结构示意 · 尺度参照 {study.reference}</span>
      </div>
      <div className="frame-legend">
        <span>
          <i />
          当前车架
        </span>
        {reference && (
          <span>
            <i />
            {reference.reference} 叠影
          </span>
        )}
      </div>
      <span className="lab-overlay">拖拽旋转 · 滚轮 / 双指缩放 · 点选结构 · 方向键 / + −</span>
      {error && (
        <div className="frame-no-webgl">
          此设备无法显示 3D。下方的几何表、设计解读和官方图鉴仍可阅读。
        </div>
      )}
    </div>
  );
}
export default function FrameLab() {
  const query = new URLSearchParams(location.search),
    initial = frameStudies.find((s) => s.id === query.get('frame')) || frameStudies[0];
  const [id, setId] = useState(initial.id),
    [selected, setSelected] = useState('tubes'),
    [view, setView] = useState<View>(query.has('compare') ? 'side' : 'perspective'),
    [showWheels, setShowWheels] = useState(true),
    [showGuides, setShowGuides] = useState(false),
    [overlay, setOverlay] = useState(
      frameStudies.some((s) => s.id === query.get('compare') && s.id !== initial.id),
    ),
    [comparison, setComparison] = useState(query.get('compare') || 'climbing'),
    [reset, setReset] = useState(0),
    [shareLink, setShareLink] = useState(''),
    [message, setMessage] = useState('');
  const study = frameStudies.find((s) => s.id === id)!;
  const reference =
    frameStudies.find((s) => s.id === comparison && s.id !== id) ||
    frameStudies.find((s) => s.id !== id)!;
  const facts = study.features.some((f) => f[0] === selected)
    ? study.features
    : [
        ...study.features,
        [
          selected,
          selected === 'clearance' ? '轮胎参照环' : '结构观察',
          selected === 'clearance'
            ? '参照环只表达此类车架的空间关系，胎宽为示意选择，不代表安装认证。'
            : '从下方观察提示选择一个部位，结合官方实拍看接点与管型。',
        ],
      ];
  const share = async () => {
    const url = new URL(base, location.origin);
    url.search = new URLSearchParams({
      view: 'workshop',
      tool: 'structures',
      study: 'frames',
      frame: id,
      ...(overlay ? { compare: reference.id } : {}),
    }).toString();
    setShareLink(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setMessage('观察链接已复制。');
    } catch {
      setMessage('请复制下方链接。');
    }
  };
  const metrics = [
    ['stack', 'Stack', 'mm'],
    ['reach', 'Reach', 'mm'],
    ['headTube', '头管', 'mm'],
    ['chainstay', '后下叉', 'mm'],
    ['wheelbase', '轴距', 'mm'],
    ['seatAngle', '座管参考角', '°'],
  ] as const;
  return (
    <div className="frame-study">
      <div className="frame-intro">
        <span className="eyebrow">THE SOUL OF A BICYCLE</span>
        <h2>五类车架的结构特点</h2>
        <p>旋转、缩放或叠加五类车架示意，比较管型、接点位置与几何。</p>
      </div>
      <div className="frame-types" role="group" aria-label="车架类型">
        {frameStudies.map((s, i) => (
          <button
            key={s.id}
            aria-pressed={s.id === id}
            onClick={() => {
              setId(s.id);
              setSelected(s.features[0][0]);
              setShareLink('');
              setMessage('');
            }}
          >
            <span>
              0{i + 1} / {s.english}
            </span>
            <strong>{s.label}</strong>
            <small>{s.reference}</small>
          </button>
        ))}
      </div>
      <div className="frame-view-tools">
        <div className="work-actions">
          {(
            [
              ['perspective', '透视观察'],
              ['side', '正侧视'],
              ['front', '前视'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              className="light-button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
          <button className="light-button" onClick={() => setReset((x) => x + 1)}>
            复位缩放
          </button>
        </div>
        <div className="work-actions">
          <label className="check-label">
            <input
              type="checkbox"
              checked={showWheels}
              onChange={(e) => setShowWheels(e.target.checked)}
            />
            轮胎参照
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(e) => setShowGuides(e.target.checked)}
            />
            几何标尺
          </label>
        </div>
      </div>
      <div className="frame-main">
        <FrameViewer
          study={study}
          reference={overlay ? reference : undefined}
          view={view}
          selected={selected}
          onSelect={setSelected}
          showWheels={showWheels}
          showGuides={showGuides}
          reset={reset}
        />
        <section className="work-panel frame-reading">
          <span className="eyebrow">{study.label} / DESIGN NOTES</span>
          <h3>{study.title}</h3>
          <p>{study.summary}</p>
          <div className="frame-question">
            <small>试着观察</small>
            <p>{study.question}</p>
          </div>
          <div className="lab-facts">
            {facts.map(([part, title, text]) => (
              <button
                key={part}
                aria-pressed={selected === part}
                onClick={() => {
                  setSelected(part);
                  if (part === 'clearance') setShowWheels(true);
                }}
              >
                <strong>
                  {title}
                  {selected === part ? ' ↖' : ''}
                </strong>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="work-panel frame-compare">
        <div>
          <h3>同尺度叠影</h3>
          <p>
            以五通为原点、相同毫米比例查看两副参考车架。切换类型保持同一预设视角；叠影默认转到正侧面。
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={overlay}
              onChange={(e) => {
                setOverlay(e.target.checked);
                if (e.target.checked) setView('side');
                setShareLink('');
              }}
            />
            叠加另一类车架
          </label>
          {overlay && (
            <label>
              叠影参考
              <select
                aria-label="叠影参考"
                value={reference.id}
                onChange={(e) => {
                  setComparison(e.target.value);
                  setShareLink('');
                }}
              >
                {frameStudies
                  .filter((s) => s.id !== id)
                  .map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.label} · {s.reference}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="work-actions">
            <a className="light-button" href={`${base}?bike=${study.bikeId}`}>
              看参考车型实拍 ↗
            </a>
            <button className="light-button" onClick={share}>
              分享这次观察
            </button>
          </div>
          {message && <p role="status">{message}</p>}
          {shareLink && (
            <input
              aria-label="车架观察分享链接"
              readOnly
              value={shareLink}
              onFocus={(e) => e.target.select()}
            />
          )}
        </div>
        <div className="frame-table-wrap">
          <table className="frame-table">
            <caption>参考车型几何；不同品牌尺码名称不等同于相同适配</caption>
            <thead>
              <tr>
                <th>参数</th>
                <th>{study.reference}</th>
                {overlay && (
                  <>
                    <th>{reference.reference}</th>
                    <th>当前 − 叠影</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {metrics.map(([key, label, unit]) => {
                const delta = +(study.geometry[key] - reference.geometry[key]).toFixed(2);
                return (
                  <tr key={key}>
                    <th>{label}</th>
                    <td>
                      {study.geometry[key]} {unit}
                    </td>
                    {overlay && (
                      <>
                        <td>
                          {reference.geometry[key]} {unit}
                        </td>
                        <td>
                          {delta > 0 ? '+' : ''}
                          {delta} {unit}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="work-panel frame-boundary">
        <strong>如何阅读这组模型</strong>
        <p>
          这是类型观察，不是对应品牌的原厂 CAD。Stack、Reach、头管、角度与轴距采用注明车型 /
          尺码的公开资料；管型截面、接点曲面、座管露出、安装座、轮胎参照和 TT
          把组为解释性建模，不用于推算重量、刚度、风阻或装配间隙。
          {study.seatTubeEstimated ? '本例座管长度也为示意值。' : ''}
        </p>
        <p className="work-note">
          类别之间存在交叉，现代破风车也可以很轻。这里没有把五类排成高低等级；几何差异属于所选样本，不代表整类车或个人选码结论。
        </p>
        <div className="frame-source-links">
          <a href={study.source} target="_blank" rel="noreferrer">
            {study.reference} 几何来源 ↗
          </a>
          {study.readingSource && (
            <a href={study.readingSource} target="_blank" rel="noreferrer">
              设计资料 ↗
            </a>
          )}
          {overlay && (
            <a href={reference.source} target="_blank" rel="noreferrer">
              {reference.reference} 叠影来源 ↗
            </a>
          )}
        </div>
        <small>
          资料核对：{study.checkedAt} · {study.sourceNote}
        </small>
      </div>
    </div>
  );
}
