import type { Bike } from '../types';
import { imageUrl } from '../catalog';
import { paintsForBike } from '../bikePaints';
import { estimate, label, money, type Plan } from './model';

export async function poster(p: Plan, bike: Bike | undefined, brand: string): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = Math.max(1440, 920 + p.items.length * 76 + 210);
  const c = canvas.getContext('2d');
  if (!c) throw Error('Canvas unavailable');
  const text = (s: string, x: number, y: number, size = 28, color = '#173c30', max = 940) => {
    c.fillStyle = color;
    c.font = `500 ${size}px sans-serif`;
    while (c.measureText(s).width > max && s.length > 1) s = s.slice(0, -2) + '…';
    c.fillText(s, x, y);
  };
  c.fillStyle = '#f4f5ed';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#173c30';
  c.fillRect(0, 0, 1080, 220);
  text(`${brand} / ${p.mode === 'build' ? '我的装车方案' : '我的升级方案'}`, 60, 75, 28, '#daee9e');
  text(p.title, 60, 154, 48, '#fff');
  let painted = false;
  if (bike) {
    const paints = paintsForBike(bike),
      paint = paints.find((x) => x.id === p.paintId) || paints[0];
    try {
      const img = new Image();
      img.src = imageUrl(paint.image);
      await img.decode();
      const s = Math.min(960 / img.naturalWidth, 370 / img.naturalHeight);
      c.drawImage(
        img,
        (1080 - img.naturalWidth * s) / 2,
        245 + (370 - img.naturalHeight * s) / 2,
        img.naturalWidth * s,
        img.naturalHeight * s,
      );
      painted = true;
    } catch {
      /* Text poster still works offline when a source image is absent. */
    }
  }
  if (!painted) text(p.bikeName || '按自己的想法，组一辆车', 60, 440, 42);
  text(p.bikeName || '自定义车辆', 60, 660, 30);
  text(
    `${p.size || '自定义尺码'} · ${painted ? '原车照片，清单配件未合成实装' : '文字配置方案'}`,
    60,
    700,
    21,
    '#687970',
  );
  const t = estimate(p);
  c.fillStyle = '#dcecaa';
  c.fillRect(60, 735, 960, 125);
  text(t.priceComplete ? '净支出估算' : '已知净支出', 85, 778, 22);
  text(money(t.net), 85, 826, 40);
  text(t.weight === null ? '重量尚未完整计算' : `${(t.weight / 1000).toFixed(3)} kg`, 610, 826, 32);
  text(p.mode === 'build' ? '所列车上零件' : '升级后估重', 610, 778, 22);
  p.items.forEach((item, i) => {
    const y = 920 + i * 76;
    c.strokeStyle = '#d9e0d3';
    c.beginPath();
    c.moveTo(60, y + 29);
    c.lineTo(1020, y + 29);
    c.stroke();
    text(label(item.category), 60, y, 22, '#65736c', 145);
    text(`${item.name || '自定义'} × ${item.quantity}`, 220, y, 26, '#173c30', 790);
    text(
      `${{ buy: '购入', keep: '沿用', remove: '拆下' }[item.action]} · ${item.variant || '自定义规格'}`,
      220,
      y + 24,
      17,
      '#65736c',
      790,
    );
  });
  const bottom = canvas.height - 130;
  text('参考价与个人报价分别记录，来源与安装条件见完整方案', 60, bottom, 22, '#65736c');
  text('不含未列零件与未计价项目', 60, bottom + 36, 22, '#65736c');
  text('hliangzhao.me/velodex', 60, bottom + 82, 25);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(Error('PNG failed'))), 'image/png'),
  );
}
