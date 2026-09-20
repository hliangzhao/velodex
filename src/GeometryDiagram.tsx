import { useId } from 'react';
import type { GeometrySize } from './types';
import profiles from './data/model-profiles.json';

type Point = { x: number; y: number };
const at = (p: Point) => `${p.x},${p.y}`;
const shift = (p: Point, x: number, y: number): Point => ({ x: p.x + x, y: p.y + y });

export default function GeometryDiagram({ g, bikeId }: { g: GeometrySize; bikeId: string }) {
  const arrowId = useId();
  const profile = profiles[bikeId as keyof typeof profiles];
  const scale = 0.37;
  const bb = { x: 236, y: 300 };
  const seatAngle = (g.seatAngle * Math.PI) / 180;
  const headAngle = (g.headAngle * Math.PI) / 180;
  const wheelY = bb.y - g.bbDrop * scale;
  const rear = { x: bb.x - Math.sqrt(g.chainstay ** 2 - g.bbDrop ** 2) * scale, y: wheelY };
  const headTop = shift(bb, g.reach * scale, -g.stack * scale);
  const headBottom = shift(
    headTop,
    Math.cos(headAngle) * g.headTube * scale,
    Math.sin(headAngle) * g.headTube * scale,
  );
  // When wheelbase is unpublished, show a schematic front axle without inventing a measurement.
  const steeringX = headTop.x + (wheelY - headTop.y) / Math.tan(headAngle);
  const front = {
    x: g.wheelbase ? rear.x + g.wheelbase * scale : steeringX + 45 * scale,
    y: wheelY,
  };
  const seatLength = g.seatTube ?? profile.seatLength + (g.stack - profile.referenceStack) * 0.95;
  const alongSeat = (length: number) =>
    shift(bb, -Math.cos(seatAngle) * length * scale, -Math.sin(seatAngle) * length * scale);
  const seatTop = alongSeat(seatLength);
  const stayJoin = alongSeat(seatLength - profile.stayDrop);
  const postTop = alongSeat(seatLength + 75);
  const wheelRadius = 338 * scale;
  const reachY = headTop.y - 38;
  const stackX = Math.max(headBottom.x, headTop.x) + 68;
  const wheelbaseY = wheelY + wheelRadius + 32;
  const left = rear.x - wheelRadius - 18;
  const right = Math.max(front.x + wheelRadius, stackX + 32) + 18;
  const top = Math.min(0, reachY - 24);
  const chainOffset = { x: -6, y: 38 };
  const headOffset = { x: 25 * Math.sin(headAngle), y: -25 * Math.cos(headAngle) };
  const dropX = bb.x + 53;
  const headAxis = { x: steeringX, y: wheelY };
  const arc = (origin: Point, angle: number, radius: number) =>
    `M ${at(shift(origin, -radius, 0))} A ${radius} ${radius} 0 0 1 ${at(shift(origin, -radius * Math.cos(angle), -radius * Math.sin(angle)))}`;
  const frame = `M ${at(bb)} L ${at(seatTop)} L ${at(headTop)} L ${at(headBottom)} Z M ${at(stayJoin)} L ${at(rear)} L ${at(bb)} M ${at(headBottom)} L ${at(front)}`;
  const dimension = (from: Point, to: Point) => (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      markerStart={`url(#${arrowId})`}
      markerEnd={`url(#${arrowId})`}
    />
  );
  const badge = (letter: string, x: number, y: number) => (
    <g className="geometry-badge" transform={`translate(${x} ${y})`}>
      <circle r="11" />
      <text textAnchor="middle" dominantBaseline="central">
        {letter}
      </text>
    </g>
  );

  return (
    <svg
      className="geometry-diagram"
      viewBox={`${left} ${top} ${right - left} ${wheelbaseY + 30 - top}`}
      fill="none"
      role="img"
      aria-label={`${g.size} 码车架几何：A Stack ${g.stack} 毫米，B Reach ${g.reach} 毫米，C 头管角 ${g.headAngle} 度，D 座管角 ${g.seatAngle} 度，E 轴距 ${g.wheelbase ?? '未公布'}，F 后下叉 ${g.chainstay} 毫米，G 五通下沉 ${g.bbDrop} 毫米，H 头管 ${g.headTube} 毫米`}
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 1 1 L 7 4 L 1 7" fill="none" stroke="#758762" strokeWidth="1.3" />
        </marker>
      </defs>
      <g className="geometry-wheels">
        {[rear, front].map((axle, i) => (
          <g key={i}>
            <circle cx={axle.x} cy={axle.y} r={wheelRadius} />
            <circle cx={axle.x} cy={axle.y} r={wheelRadius - 6} />
            <path d={`M ${axle.x - 7} ${axle.y} h 14 M ${axle.x} ${axle.y - 7} v 14`} />
          </g>
        ))}
      </g>
      <g className="geometry-frame" strokeLinejoin="round" strokeLinecap="round">
        <path d={frame} strokeWidth="9" />
        <path d={frame} className="geometry-frame-inner" strokeWidth="5.5" />
        <path
          d={`M ${at(seatTop)} L ${at(postTop)} M ${postTop.x - 17} ${postTop.y} h 35`}
          strokeWidth="2.5"
        />
        <circle cx={bb.x} cy={bb.y} r="9" />
      </g>
      <g className="geometry-guides">
        <path
          d={`M ${rear.x - 16} ${wheelY} H ${front.x + 20} M ${bb.x - 72} ${bb.y} H ${stackX + 7}`}
        />
        <path
          d={`M ${bb.x} ${bb.y - 10} V ${reachY - 9} M ${headTop.x} ${headTop.y} V ${reachY - 9} M ${headTop.x} ${headTop.y} H ${stackX + 7}`}
        />
        <path d={`M ${at(headTop)} L ${steeringX + 8 / Math.tan(headAngle)} ${wheelY + 8}`} />
        <path d={`M ${at(rear)} V ${wheelbaseY + 8} M ${at(front)} V ${wheelbaseY + 8}`} />
        <path
          d={`M ${at(rear)} l ${chainOffset.x - 2} ${chainOffset.y + 9} M ${at(bb)} l ${chainOffset.x - 2} ${chainOffset.y + 9}`}
        />
        <path
          d={`M ${at(headTop)} l ${headOffset.x + 10} ${headOffset.y - 3} M ${at(headBottom)} l ${headOffset.x + 10} ${headOffset.y - 3}`}
        />
      </g>
      <g className="geometry-dimensions">
        {dimension({ x: bb.x, y: reachY }, { x: headTop.x, y: reachY })}
        {dimension({ x: stackX, y: headTop.y }, { x: stackX, y: bb.y })}
        {g.wheelbase !== null &&
          dimension({ x: rear.x, y: wheelbaseY }, { x: front.x, y: wheelbaseY })}
        {dimension(
          shift(rear, chainOffset.x, chainOffset.y),
          shift(bb, chainOffset.x, chainOffset.y),
        )}
        {dimension(
          shift(headTop, headOffset.x, headOffset.y),
          shift(headBottom, headOffset.x, headOffset.y),
        )}
        {dimension({ x: dropX, y: wheelY }, { x: dropX, y: bb.y })}
        <path d={arc(bb, seatAngle, 53)} />
        <path d={arc(headAxis, headAngle, 55)} />
      </g>
      <g className="geometry-labels" textAnchor="middle">
        <text x={(bb.x + headTop.x) / 2} y={reachY - 12}>
          B · REACH {g.reach}
        </text>
        <text transform={`translate(${stackX + 18} ${(headTop.y + bb.y) / 2}) rotate(-90)`}>
          A · STACK {g.stack}
        </text>
        <text x={(rear.x + front.x) / 2} y={wheelbaseY + 5}>
          E · {g.wheelbase ?? '—'}
        </text>
      </g>
      {badge('C', headAxis.x - 57, wheelY - 43)}
      {badge('D', bb.x - 61, bb.y - 42)}
      {badge('F', (rear.x + bb.x) / 2 + chainOffset.x, (wheelY + bb.y) / 2 + chainOffset.y)}
      {badge('G', dropX + 20, (wheelY + bb.y) / 2)}
      {badge(
        'H',
        (headTop.x + headBottom.x) / 2 + headOffset.x + 16,
        (headTop.y + headBottom.y) / 2 + headOffset.y,
      )}
      <g className="geometry-datums">
        <circle cx={bb.x} cy={bb.y} r="3.5" />
        <circle cx={headTop.x} cy={headTop.y} r="3.5" />
      </g>
    </svg>
  );
}
