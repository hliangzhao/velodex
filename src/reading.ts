export type ReadingSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  checkedAt: string;
};
export type ReadingArticle = {
  id: string;
  kind: 'race' | 'science';
  topic: string;
  kicker: string;
  title: string;
  dek: string;
  takeaway: string;
  checkedAt: string;
  minutes: number;
  heroBikeId?: string;
  image?: string;
  heroCaption?: string;
  imageSource?: string;
  sections: {
    id: string;
    title: string;
    label: string;
    paragraphs: string[];
    sourceIds: string[];
    rows?: string[][];
    formula?: string;
  }[];
  lab?: 'aero' | 'gears' | 'mass';
  bikeIds: string[];
  productIds: string[];
  relatedIds: string[];
  actions: { label: string; search: string }[];
  boundary: string;
  quiz: { question: string; options: string[]; answer: number; explanation: string };
};
export const readingTopics = [
  ['all', '所有话题'],
  ['aero', '空气动力学'],
  ['drivetrain', '齿比与传动'],
  ['rolling', '轮胎与路面'],
  ['frame', '车架与重量'],
  ['power', '功率与训练'],
] as const;

// Along-road mechanical power for a steady positive ground speed and a headwind.
// No lateral wind, rolling resistance, drivetrain loss, or rider power prediction.
export function airPower(speedKmh: number, cda: number, headwindKmh = 0) {
  if (
    ![speedKmh, cda, headwindKmh].every(Number.isFinite) ||
    speedKmh < 0 ||
    cda < 0 ||
    headwindKmh < 0
  )
    throw new RangeError('Expected non-negative finite speed, CdA and headwind');
  const ground = speedKmh / 3.6;
  const air = (speedKmh + headwindKmh) / 3.6;
  return 0.5 * 1.225 * cda * air ** 2 * ground;
}

export function massPowerSaving(speedKmh: number, gradePercent: number, kilograms: number) {
  if (
    ![speedKmh, gradePercent, kilograms].every(Number.isFinite) ||
    speedKmh < 0 ||
    gradePercent < 0 ||
    kilograms < 0
  )
    throw new RangeError('Expected non-negative finite speed, gradient and mass');
  const theta = Math.atan(gradePercent / 100);
  const scale = kilograms * 9.80665 * (speedKmh / 3.6);
  return { gravity: scale * Math.sin(theta), rolling: scale * 0.004 * Math.cos(theta) };
}
