import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { THEME, GAS_THRESHOLD } from '../constants';

type Point = { ppm: number; label?: string };

type GasChartProps = {
  data: Point[];
  height?: number;
  maxPpm?: number;
};

export default function GasChart({ data, height = 160, maxPpm = 800 }: GasChartProps) {
  if (data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No chart data yet</Text>
      </View>
    );
  }

  const width = 320;
  const pad = { top: 18, right: 12, bottom: 34, left: 44 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const rawMin = Math.min(...data.map(d => d.ppm));
  const rawMax = Math.max(...data.map(d => d.ppm));
  const dataSpread = rawMax - rawMin;
  const chartPadding = Math.max(dataSpread * 0.2, 10);
  const yMin = Math.max(0, rawMin - chartPadding);
  const yMax = Math.max(maxPpm, rawMax + chartPadding, GAS_THRESHOLD + 50, yMin + 20);
  const range = Math.max(yMax - yMin, 1);

  const points = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = pad.top + chartH - ((d.ppm - yMin) / range) * chartH;
    return { x, y, ppm: d.ppm, label: d.label };
  });

  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const thresholdY = pad.top + chartH - ((GAS_THRESHOLD - yMin) / range) * chartH;
  const midValue = Math.round((yMax + yMin) / 2);
  const yTicks = [yMax, midValue, yMin];
  const xTicks = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    .filter((idx, pos, arr) => arr.indexOf(idx) === pos && idx >= 0 && idx < points.length);

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {yTicks.map((value) => {
          const y = pad.top + chartH - ((value - yMin) / range) * chartH;
          return (
            <React.Fragment key={value}>
              <Line
                x1={pad.left}
                y1={y}
                x2={width - pad.right}
                y2={y}
                stroke={THEME.border}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <SvgText
                x={pad.left - 8}
                y={y + 3}
                fill={THEME.textMuted}
                fontSize={9}
                textAnchor="end"
              >
                {value}
              </SvgText>
            </React.Fragment>
          );
        })}

        <Line
          x1={pad.left}
          y1={thresholdY}
          x2={width - pad.right}
          y2={thresholdY}
          stroke={THEME.danger}
          strokeWidth={1.5}
          strokeDasharray="6,4"
          opacity={0.7}
        />

        {points.map((p, i) => (
          <Rect
            key={`bar-${i}`}
            x={p.x - 4}
            y={p.y}
            width={8}
            height={pad.top + chartH - p.y}
            fill={p.ppm >= GAS_THRESHOLD ? THEME.danger : THEME.primary}
            opacity={0.35}
            rx={2}
          />
        ))}

        <Polyline
          points={linePoints}
          fill="none"
          stroke={THEME.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <Circle
            key={`dot-${i}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={p.ppm >= GAS_THRESHOLD ? THEME.danger : THEME.primary}
          />
        ))}

        {xTicks.map((idx) => {
          const point = points[idx];
          if (!point?.label) return null;
          return (
            <SvgText
              key={`x-${idx}`}
              x={point.x}
              y={height - 10}
              fill={THEME.textMuted}
              fontSize={9}
              textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
            >
              {point.label}
            </SvgText>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: THEME.primary }]} />
          <Text style={styles.legendText}>Gas level</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: THEME.danger }]} />
          <Text style={styles.legendText}>Threshold {GAS_THRESHOLD} ppm</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  empty: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: THEME.textMuted, fontSize: 13 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 16, height: 2, borderRadius: 1 },
  legendText: { fontSize: 11, color: THEME.textMuted },
});
