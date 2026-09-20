import { imageUrl } from './catalog';
import { paintsForBike } from './bikePaints';
import type { Bike, Product } from './types';
import { slots, totals, type DreamBuild } from './workshop';

export function itemName(build: DreamBuild, slot: string, bike: Bike, products: Product[]) {
  const item = build.items[slot as keyof DreamBuild['items']];
  if (slot === 'frame') return `${bike.family} · 车架平台`;
  return products.find((p) => p.id === item.choice)?.name || item.custom || '尚未选择';
}
export async function drawPoster(
  build: DreamBuild,
  bike: Bike,
  products: Product[],
): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1600;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('浏览器无法生成海报');
  const paint = paintsForBike(bike).find((p) => p.id === build.paintId) || paintsForBike(bike)[0];
  const picture = new Image();
  picture.src = imageUrl(paint.image);
  await picture.decode();
  c.fillStyle = '#f1f0e8';
  c.fillRect(0, 0, 1080, 1600);
  c.fillStyle = '#17392e';
  c.fillRect(0, 0, 1080, 210);
  c.fillStyle = '#d9f479';
  c.font = '600 30px "Barlow Condensed", sans-serif';
  c.fillText('VÉLODEX / DREAM BUILD', 64, 68);
  const fitText = (
    s: string,
    x: number,
    y: number,
    max: number,
    size: number,
    color = '#17392e',
  ) => {
    c.fillStyle = color;
    c.font = `600 ${size}px sans-serif`;
    while (c.measureText(s).width > max && size > 18) {
      size--;
      c.font = `600 ${size}px sans-serif`;
    }
    if (c.measureText(s).width > max) {
      while (c.measureText(s + '…').width > max) s = s.slice(0, -1);
      s += '…';
    }
    c.fillText(s, x, y);
  };
  fitText(build.title || '我的梦幻装车单', 64, 147, 952, 46, '#f1f0e8');
  const scale = Math.min(960 / picture.naturalWidth, 440 / picture.naturalHeight);
  c.drawImage(
    picture,
    (1080 - picture.naturalWidth * scale) / 2,
    225 + (440 - picture.naturalHeight * scale) / 2,
    picture.naturalWidth * scale,
    picture.naturalHeight * scale,
  );
  fitText(bike.family, 64, 705, 952, 48);
  fitText(paint.name, 64, 744, 952, 24, '#627068');
  c.font = '20px sans-serif';
  c.fillStyle = '#627068';
  c.fillText('灵感车型原图 · 不代表所选配件的实装效果', 64, 777);
  slots.forEach(([slot, label], i) => {
    const y = 825 + i * 57;
    c.strokeStyle = '#d7d9cd';
    c.beginPath();
    c.moveTo(64, y - 19);
    c.lineTo(1016, y - 19);
    c.stroke();
    c.font = '23px sans-serif';
    c.fillStyle = '#627068';
    c.fillText(label, 64, y + 14);
    fitText(itemName(build, slot, bike, products), 265, y + 14, 735, 26);
  });
  c.fillStyle = '#d9f479';
  c.fillRect(64, 1300, 952, 116);
  const g = totals(build, 'grams'),
    p = totals(build, 'yuan');
  fitText(
    `${g.known === g.total ? '清单重量' : '已填重量'} ${g.known ? (g.value / 1000).toFixed(2) + ' kg' : '待填写'}`,
    90,
    1351,
    435,
    30,
  );
  fitText(
    `${p.known === p.total ? '清单预算' : '已填预算'} ${p.known ? '¥' + p.value.toLocaleString('zh-CN') : '待填写'}`,
    560,
    1351,
    430,
    30,
  );
  c.font = '20px sans-serif';
  c.fillStyle = '#17392e';
  c.fillText(`${g.known} / ${g.total} 项已填 · 非实车称重`, 90, 1387);
  c.fillText(`${p.known} / ${p.total} 项已填 · 用户预算`, 560, 1387);
  c.fillStyle = '#627068';
  c.font = '20px sans-serif';
  c.fillText('配件与车架兼容性需另行核验；空白项目未计入。', 64, 1464);
  c.fillText(`原图：${bike.imageCredit.slice(0, 65)}`, 64, 1500);
  c.fillStyle = '#17392e';
  c.font = '600 26px "Barlow", sans-serif';
  c.fillText('hliangzhao.me/velodex', 64, 1560);
  c.font = '22px sans-serif';
  c.fillText('献给每一个忍不住回头看车的人。', 614, 1560);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG 导出失败'))),
      'image/png',
    ),
  );
}
