import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Rect, Circle } from 'react-native-svg';
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
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const max = Math.max(maxPpm, ...data.map(d => d.ppm), GAS_THRESHOLD + 50);

  const points = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = pad.top + chartH - (d.ppm / max) * chartH;
    return { x, y, ppm: d.ppm };
  });

  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const thresholdY = pad.top + chartH - (GAS_THRESHOLD / max) * chartH;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = pad.top + chartH * (1 - f);
          return (
            <Line
              key={f}
              x1={pad.left}
              y1={y}
              x2={width - pad.right}
              y2={y}
              stroke={THEME.border}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
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
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: THEME.primary }]} />
          <Text style={styles.legendText}>Gas level</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: THEME.danger }]} />
          <Text style={styles.legendText}>Threshold {GAS_THRESHOLD}</Text>
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
