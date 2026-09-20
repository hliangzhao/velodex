export type RidePoint = {
  time: number;
  segment: number;
  lat?: number;
  lon?: number;
  elevation?: number;
  distance?: number;
  speed?: number;
  power?: number;
};
export type Ride = { format: string; points: RidePoint[]; discarded: number };
export type RideSettings = {
  rider: number;
  bike: number;
  cargo: number;
  cda: number;
  crr: number;
  rho: number;
  efficiency: number;
  wind: number;
  flat: boolean;
};
export const defaultRideSettings: RideSettings = {
  rider: 70,
  bike: 8,
  cargo: 1.5,
  cda: 0.32,
  crr: 0.005,
  rho: 1.225,
  efficiency: 0.97,
  wind: 0,
  flat: false,
};
export const MAX_RIDE_BYTES = 10 * 1024 * 1024;
const finite = (n: number | undefined): n is number => n != null && Number.isFinite(n);
const number = (s: string | null | undefined) =>
  s?.trim() && Number.isFinite(Number(s)) ? Number(s) : undefined;
const descendants = (el: Element, name: string) => Array.from(el.getElementsByTagNameNS('*', name));
const content = (el: Element, names: string[]) => {
  for (const name of names) {
    const v = descendants(el, name)[0]?.textContent;
    if (v?.trim()) return v;
  }
};
const inRange = (n: number | undefined, min: number, max: number) =>
  finite(n) && n >= min && n <= max ? n : undefined;

// Parse only in the browser: coordinates and the source file never leave this page.
export function parseRideXML(xml: string): Ride {
  if (new TextEncoder().encode(xml).length > MAX_RIDE_BYTES)
    throw new Error('文件超过 10 MB，请先导出较短的单次骑行。');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('不支持带有 DTD 或实体声明的 XML。');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || !doc.documentElement)
    throw new Error('XML 格式无法读取，请重新导出 GPX 或 TCX。');
  const root = doc.documentElement;
  const gpx = root.localName === 'gpx';
  if (!gpx && root.localName !== 'TrainingCenterDatabase')
    throw new Error('只支持 GPX 轨迹或 TCX 活动文件。');
  const tracks = descendants(root, gpx ? 'trkseg' : 'Track');
  const groups = tracks.length ? tracks : gpx ? descendants(root, 'rte') : [];
  const points: RidePoint[] = [];
  let discarded = 0;
  let seen = 0;
  let segment = 0;
  for (const group of groups) {
    segment++;
    let previous = -Infinity;
    for (const node of descendants(
      group,
      gpx ? (group.localName === 'rte' ? 'rtept' : 'trkpt') : 'Trackpoint',
    )) {
      if (++seen > 100000) throw new Error('记录超过 100,000 个点，请先裁剪活动。');
      const stamp = content(node, [gpx ? 'time' : 'Time']);
      const time = stamp ? Date.parse(stamp) / 1000 : NaN;
      if (!Number.isFinite(time)) {
        discarded++;
        segment++;
        previous = -Infinity;
        continue;
      }
      if (points.length && time <= points.at(-1)!.time) {
        discarded++;
        segment++;
        continue;
      }
      if (time <= previous || time - previous > 30) segment++;
      previous = time;
      const power = inRange(number(content(node, ['Watts', 'watts', 'power', 'Power'])), 0, 5000);
      points.push({
        time,
        segment,
        lat: inRange(
          number(gpx ? node.getAttribute('lat') : content(node, ['LatitudeDegrees'])),
          -90,
          90,
        ),
        lon: inRange(
          number(gpx ? node.getAttribute('lon') : content(node, ['LongitudeDegrees'])),
          -180,
          180,
        ),
        elevation: inRange(number(content(node, [gpx ? 'ele' : 'AltitudeMeters'])), -500, 10000),
        distance: gpx ? undefined : inRange(number(content(node, ['DistanceMeters'])), 0, 10000000),
        speed: inRange(number(content(node, gpx ? ['speed'] : ['Speed'])), 0, 40),
        power,
      });
    }
  }
  if (points.length < 2)
    throw new Error('需要至少两个带时间戳的轨迹点。只有路线、没有时间的 GPX 无法计算功率。');
  if (points.at(-1)!.time - points[0].time > 7 * 86400) throw new Error('请导出单次骑行活动。');
  return { format: gpx ? 'GPX' : 'TCX', points, discarded };
}

export function validRideSettings(s: RideSettings) {
  return (
    Object.values(s).every((v) => typeof v === 'boolean' || Number.isFinite(v)) &&
    s.rider >= 20 &&
    s.rider <= 250 &&
    s.bike >= 3 &&
    s.bike <= 50 &&
    s.cargo >= 0 &&
    s.cargo <= 50 &&
    s.cda >= 0.1 &&
    s.cda <= 1 &&
    s.crr >= 0.001 &&
    s.crr <= 0.03 &&
    s.rho >= 0.7 &&
    s.rho <= 1.5 &&
    s.efficiency >= 0.8 &&
    s.efficiency <= 1 &&
    s.wind >= -20 &&
    s.wind <= 20
  );
}
export function powerModel(speed: number, grade: number, acceleration: number, s: RideSettings) {
  const mass = s.rider + s.bike + s.cargo,
    g = 9.80665;
  const angle = Math.atan(grade),
    airSpeed = speed + s.wind;
  const aero = 0.5 * s.rho * s.cda * airSpeed * Math.abs(airSpeed) * speed;
  const rolling = mass * g * s.crr * Math.cos(angle) * speed;
  const climbing = mass * g * Math.sin(angle) * speed;
  const accelerating = mass * acceleration * speed;
  return {
    aero,
    rolling,
    climbing,
    accelerating,
    watts: Math.max(0, (aero + rolling + climbing + accelerating) / s.efficiency),
  };
}
function haversine(a: RidePoint, b: RidePoint) {
  if (![a.lat, a.lon, b.lat, b.lon].every(finite)) return undefined;
  const r = Math.PI / 180,
    lat = (b.lat! - a.lat!) * r,
    lon = (b.lon! - a.lon!) * r;
  const h =
    Math.sin(lat / 2) ** 2 + Math.cos(a.lat! * r) * Math.cos(b.lat! * r) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export type RideInterval = {
  start: number;
  end: number;
  segment: number;
  distance?: number;
  speed?: number;
  elevation?: number;
  measured?: number;
  estimated?: number;
  low?: number;
  high?: number;
};

// Thirty-second, time-bounded smoothing is confined to each continuous track segment.
function smooth(values: (number | undefined)[], times: number[], halfWindow = 15) {
  const sum = [0],
    count = [0];
  values.forEach((v) => {
    sum.push(sum.at(-1)! + (finite(v) ? v : 0));
    count.push(count.at(-1)! + (finite(v) ? 1 : 0));
  });
  let left = 0,
    right = 0;
  return values.map((v, i) => {
    while (left < i && times[left] < times[i] - halfWindow) left++;
    while (right < times.length && times[right] <= times[i] + halfWindow) right++;
    return finite(v) && count[right] > count[left]
      ? (sum[right] - sum[left]) / (count[right] - count[left])
      : undefined;
  });
}
export function rideIntervals(ride: Ride, settings: RideSettings) {
  if (!validRideSettings(settings)) throw new Error('请检查重量、风阻、滚阻和空气密度的输入范围。');
  const groups: RidePoint[][] = [];
  for (const p of ride.points) {
    const current = groups.at(-1),
      last = current?.at(-1);
    if (!last || p.segment !== last.segment || p.time <= last.time || p.time - last.time > 30)
      groups.push([p]);
    else current!.push(p);
  }
  const result: RideInterval[] = [];
  let skipped = 0;
  for (const [groupId, pts] of groups.entries()) {
    const alt = smooth(
      pts.map((p) => p.elevation),
      pts.map((p) => p.time),
    );
    const raw: RideInterval[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i],
        dt = b.time - a.time;
      let distance: number | undefined;
      if (finite(a.distance) && finite(b.distance) && b.distance >= a.distance)
        distance = b.distance - a.distance;
      else distance = haversine(a, b);
      if (!finite(distance) && finite(a.speed) && finite(b.speed))
        distance = ((a.speed + b.speed) / 2) * dt;
      let speed = finite(distance) ? distance / dt : undefined;
      if (finite(speed) && (speed < 0 || speed > 40)) {
        skipped++;
        speed = undefined;
        distance = undefined;
      }
      const measured = finite(a.power) && finite(b.power) ? (a.power + b.power) / 2 : undefined;
      raw.push({
        start: a.time,
        end: b.time,
        segment: groupId,
        distance,
        speed,
        elevation: finite(alt[i - 1]) && finite(alt[i]) ? alt[i]! - alt[i - 1]! : undefined,
        measured,
      });
    }
    const speeds = smooth(
      raw.map((p) => p.speed),
      raw.map((p) => (p.start + p.end) / 2),
    );
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i],
        speed = speeds[i],
        dt = row.end - row.start;
      if (finite(speed) && finite(row.distance) && (settings.flat || finite(row.elevation))) {
        const grade = settings.flat || row.distance < 2 ? 0 : row.elevation! / row.distance;
        const previous = raw[i - 1],
          prevSpeed = speeds[i - 1];
        const acceleration =
          previous && previous.end === row.start && finite(prevSpeed)
            ? (speed - prevSpeed) / ((dt + previous.end - previous.start) / 2)
            : 0;
        if (Math.abs(grade) <= 0.3 && Math.abs(acceleration) <= 3) {
          const estimate = (cda: number) =>
            speed < 0.3 ? 0 : powerModel(speed, grade, acceleration, { ...settings, cda }).watts;
          row.estimated = estimate(settings.cda);
          const cases = [estimate(settings.cda * 0.8), estimate(settings.cda * 1.2)];
          row.low = Math.min(...cases);
          row.high = Math.max(...cases);
        }
      }
      result.push(row);
    }
  }
  return { intervals: result, skipped };
}
export function weightedPower(
  intervals: RideInterval[],
  key: 'measured' | 'estimated' | 'low' | 'high',
) {
  let duration = 0,
    joules = 0;
  for (const p of intervals)
    if (finite(p[key])) {
      const dt = p.end - p.start;
      duration += dt;
      joules += p[key]! * dt;
    }
  return { seconds: duration, joules, average: duration ? joules / duration : undefined };
}
export function bestMeasuredWindow(intervals: RideInterval[], seconds = 1200) {
  const groups: RideInterval[][] = [];
  for (const row of intervals) {
    if (!finite(row.measured)) continue;
    const last = groups.at(-1)?.at(-1);
    if (!last || last.end !== row.start || last.segment !== row.segment) groups.push([row]);
    else groups.at(-1)!.push(row);
  }
  let best: number | undefined;
  for (const rows of groups) {
    if (rows.at(-1)!.end - rows[0].start < seconds) continue;
    const sums = [0];
    rows.forEach((r) => sums.push(sums.at(-1)! + r.measured! * (r.end - r.start)));
    const energyAt = (time: number) => {
      let lo = 0,
        hi = rows.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (rows[mid].end <= time) lo = mid + 1;
        else hi = mid;
      }
      return (
        sums[lo] + (lo < rows.length ? Math.max(0, time - rows[lo].start) * rows[lo].measured! : 0)
      );
    };
    for (const end of rows.flatMap((r) => [r.end, r.start + seconds])) {
      if (end < rows[0].start + seconds || end > rows.at(-1)!.end) continue;
      const average = (energyAt(end) - energyAt(end - seconds)) / seconds;
      best = best == null ? average : Math.max(best, average);
    }
  }
  return best;
}
export function analyzeRide(ride: Ride, settings: RideSettings) {
  const { intervals, skipped } = rideIntervals(ride, settings);
  if (!intervals.length)
    throw new Error('没有可分析的连续时间区间；时间重复、分段或长于 30 秒的缺口不会被拼接。');
  const duration = intervals.reduce((n, r) => n + r.end - r.start, 0);
  const measured = weightedPower(intervals, 'measured'),
    estimated = weightedPower(intervals, 'estimated');
  return {
    intervals,
    skipped,
    duration,
    measured,
    estimated,
    low: weightedPower(intervals, 'low').average,
    high: weightedPower(intervals, 'high').average,
    best20: bestMeasuredWindow(intervals),
    distance: intervals.reduce((n, r) => n + (r.distance ?? 0), 0),
    distanceSeconds: intervals
      .filter((r) => finite(r.distance))
      .reduce((n, r) => n + r.end - r.start, 0),
    climbing: intervals.reduce((n, r) => n + Math.max(0, r.elevation ?? 0), 0),
    altitudeSeconds: intervals
      .filter((r) => finite(r.elevation))
      .reduce((n, r) => n + r.end - r.start, 0),
  };
}
export function demoRide(): Ride {
  const points: RidePoint[] = [];
  for (let t = 0; t <= 1800; t += 5)
    points.push({
      time: t,
      segment: 0,
      distance: t * 8,
      elevation: 100 + t * 0.05,
      power: 200 + 35 * Math.sin(t / 140),
    });
  return { format: '模拟数据 · 非真实骑行', points, discarded: 0 };
}
