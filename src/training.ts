import { bestMeasuredWindow, type Ride, type RideInterval } from './ride';

export const trainingSources = {
  zones: 'https://www.trainingpeaks.com/blog/power-training-levels/',
  np: 'https://www.trainingpeaks.com/coach-blog/normalized-power-how-coaches-use/',
  load: 'https://help.trainingpeaks.com/hc/en-us/articles/204071804-Normalized-Power',
};
export const zoneNames = ['恢复', '耐力', '节奏', '阈值附近', '高有氧强度', '高于 120% FTP'];
export const zoneBounds = [0.55, 0.75, 0.9, 1.05, 1.2, Infinity];
export const validFTP = (ftp: number) => Number.isFinite(ftp) && ftp > 0 && ftp <= 1000;
const validPower = (p: number | undefined): p is number =>
  p != null && Number.isFinite(p) && p >= 0 && p <= 5000;
export function trainingAnalysis(ride: Ride, ftp: number) {
  const intervals: RideInterval[] = [];
  let heartSeconds = 0,
    heartSum = 0,
    cadenceSeconds = 0,
    cadenceSum = 0;
  for (let i = 1; i < ride.points.length; i++) {
    const a = ride.points[i - 1],
      b = ride.points[i],
      dt = b.time - a.time;
    if (a.segment !== b.segment || dt <= 0 || dt > 5) continue;
    if (a.heartRate != null && b.heartRate != null) {
      heartSeconds += dt;
      heartSum += ((a.heartRate + b.heartRate) / 2) * dt;
    }
    if (a.cadence != null && b.cadence != null) {
      cadenceSeconds += dt;
      cadenceSum += ((a.cadence + b.cadence) / 2) * dt;
    }
    if (!validPower(a.power) || !validPower(b.power)) continue;
    intervals.push({
      start: a.time,
      end: b.time,
      segment: a.segment,
      measured: (a.power + b.power) / 2,
    });
  }
  const elapsed = Math.max(0, (ride.points.at(-1)?.time || 0) - (ride.points[0]?.time || 0));
  let seconds = 0,
    joules = 0;
  const zones = zoneNames.map((name, i) => ({ name, upper: zoneBounds[i], seconds: 0 }));
  for (const r of intervals) {
    const dt = r.end - r.start;
    seconds += dt;
    joules += r.measured! * dt;
    if (validFTP(ftp))
      zones[zoneBounds.findIndex((bound) => r.measured! <= ftp * bound)].seconds += dt;
  }
  const complete =
    elapsed > 0 &&
    Math.abs(seconds - elapsed) < 0.001 &&
    intervals.every(
      (r, i) => !i || (intervals[i - 1].end === r.start && intervals[i - 1].segment === r.segment),
    );
  // Use only complete recordings for whole-session load. Never bridge a pause or missing sample.
  let np: number | undefined;
  if (complete && elapsed >= 600) {
    const energy = [0];
    intervals.forEach((r) => energy.push(energy.at(-1)! + r.measured! * (r.end - r.start)));
    const at = (time: number) => {
      let lo = 0,
        hi = intervals.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (intervals[m].end <= time) lo = m + 1;
        else hi = m;
      }
      return (
        energy[lo] +
        (lo < intervals.length
          ? Math.max(0, time - intervals[lo].start) * intervals[lo].measured!
          : 0)
      );
    };
    let fourth = 0,
      count = 0;
    for (let end = intervals[0].start + 30; end <= intervals.at(-1)!.end; end += 1) {
      fourth += ((at(end) - at(end - 30)) / 30) ** 4;
      count++;
    }
    if (count) np = (fourth / count) ** 0.25;
  }
  const intensity = np != null && validFTP(ftp) ? np / ftp : undefined;
  const peaks = [5, 60, 300, 1200, 3600].map((duration) => ({
    duration,
    watts: bestMeasuredWindow(
      duration === 5 ? intervals.filter((r) => r.end - r.start <= 1) : intervals,
      duration,
    ),
  }));
  return {
    elapsed,
    seconds,
    missing: elapsed - seconds,
    coverage: elapsed ? seconds / elapsed : 0,
    mean: seconds ? joules / seconds : undefined,
    kj: joules / 1000,
    zones,
    peaks,
    complete,
    np,
    intensity,
    tss: intensity != null ? (elapsed / 3600) * intensity ** 2 * 100 : undefined,
    variability: np != null && joules > 0 ? np / (joules / seconds) : undefined,
    heartRate: heartSeconds ? heartSum / heartSeconds : undefined,
    heartCoverage: elapsed ? heartSeconds / elapsed : 0,
    cadence: cadenceSeconds ? cadenceSum / cadenceSeconds : undefined,
    cadenceCoverage: elapsed ? cadenceSeconds / elapsed : 0,
  };
}
export type WorkoutGoal = 'recovery' | 'endurance' | 'tempo' | 'threshold';
export type WorkoutBlock = { name: string; minutes: number; low: number; high: number };
export function workout(goal: WorkoutGoal, duration: number): WorkoutBlock[] {
  const minutes = [30, 45, 60, 90].includes(duration) ? duration : 45;
  const easy = (name: string, minutes: number): WorkoutBlock => ({
    name,
    minutes,
    low: 0.45,
    high: 0.55,
  });
  if (goal === 'recovery') return [{ name: '轻松转腿', minutes, low: 0.4, high: 0.55 }];
  if (goal === 'endurance')
    return [
      easy('热身', 8),
      { name: '平稳耐力', minutes: minutes - 13, low: 0.6, high: 0.7 },
      easy('放松', 5),
    ];
  const reps = minutes >= 60 ? 3 : 2,
    block = minutes >= 45 ? 8 : 5,
    rest = 4;
  return [
    easy('热身', 10),
    ...Array.from({ length: reps }, (_, i) => [
      {
        name: `${goal === 'tempo' ? '节奏' : '阈值附近'} ${i + 1}`,
        minutes: block,
        low: goal === 'tempo' ? 0.8 : 0.92,
        high: goal === 'tempo' ? 0.87 : 0.98,
      },
      ...(i < reps - 1 ? [easy('组间恢复', rest)] : []),
    ]).flat(),
    easy('轻松骑行与放松', minutes - 10 - reps * block - (reps - 1) * rest),
  ];
}
export function workoutText(goal: WorkoutGoal, duration: number, ftp: number) {
  return [
    '骑行训练参考课表',
    `FTP ${ftp} W · ${duration} 分钟`,
    ...workout(goal, duration).map(
      (b) =>
        `${b.name}：${b.minutes} 分钟，${Math.round(b.low * ftp)}–${Math.round(b.high * ftp)} W`,
    ),
    '功率目标是参考范围。根据当天恢复情况调整；近期高强度或疲劳未消退时改为轻松骑行。',
    '没有近期稳定训练习惯时，先选恢复或耐力。模板不是根据单次文件推断出的个体训练处方。',
    trainingSources.zones,
  ].join('\n');
}
export type TrainingEntry = {
  id: string;
  name: string;
  date: string;
  minutes: number;
  ftp: number | null;
  mean: number | null;
  tss: number | null;
  rpe: number;
  source: 'meter' | 'unknown' | 'estimated';
};
export const historyKey = 'velodex.training.history.v1';
export const profileKey = 'velodex.training.profile.v1';
export type TrainingProfile = { ftp: number; updatedAt: string };
export function parseTrainingProfile(raw: unknown): TrainingProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as TrainingProfile;
  if (
    typeof p.ftp !== 'number' ||
    !validFTP(p.ftp) ||
    typeof p.updatedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(p.updatedAt) ||
    !Number.isFinite(Date.parse(p.updatedAt)) ||
    new Date(p.updatedAt).toISOString().slice(0, 10) !== p.updatedAt
  )
    return null;
  return { ftp: p.ftp, updatedAt: p.updatedAt };
}
export function readTrainingProfile(): TrainingProfile | null {
  try {
    return parseTrainingProfile(JSON.parse(localStorage.getItem(profileKey) || 'null'));
  } catch {
    return null;
  }
}
/** Seven local calendar dates, including today; unrecorded days are not assumed rest days. */
export function trainingWeek(entries: TrainingEntry[], now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i, 12);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const rides = entries.filter((e) => e.date === date);
    return {
      date,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      count: rides.length,
      minutes: rides.reduce((sum, e) => sum + e.minutes, 0),
    };
  });
}
export function parseTrainingHistory(raw: unknown): TrainingEntry[] {
  if (!Array.isArray(raw)) return [];
  const num = (x: unknown, lo: number, hi: number) =>
    typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
  const seen = new Set<string>();
  return raw.slice(0, 120).flatMap((e) => {
    if (
      !e ||
      typeof e.id !== 'string' ||
      !/^[\w-]{1,80}$/.test(e.id) ||
      seen.has(e.id) ||
      typeof e.name !== 'string' ||
      e.name.length > 120 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
      !Number.isFinite(Date.parse(e.date)) ||
      !num(e.minutes, 0, 10080) ||
      !num(e.rpe, 1, 10) ||
      !['meter', 'unknown', 'estimated'].includes(e.source) ||
      !(e.ftp === null || num(e.ftp, 1, 1000)) ||
      !(e.mean === null || num(e.mean, 0, 5000)) ||
      !(e.tss === null || num(e.tss, 0, 1000000))
    )
      return [];
    seen.add(e.id);
    return [
      {
        id: e.id,
        name: e.name,
        date: e.date,
        minutes: e.minutes,
        ftp: e.ftp,
        mean: e.mean,
        tss: e.source === 'meter' && e.ftp != null ? e.tss : null,
        rpe: e.rpe,
        source: e.source,
      },
    ];
  });
}
export function rideFingerprint(ride: Ride) {
  const sample = `${ride.points[0]?.time}|${ride.points.at(-1)?.time}|${ride.points.length}|${ride.points.reduce((n, p) => n + (p.power || 0), 0)}`;
  let n = 2166136261;
  for (const c of sample) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return `ride-${(n >>> 0).toString(16)}`;
}
