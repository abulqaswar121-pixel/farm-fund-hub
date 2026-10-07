import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { dateLabel, number } from "@/lib/agri/format";
import type { TelemetryPoint } from "@/lib/agri.member.functions";

/**
 * Live pond telemetry: sampled weight against the cycle's target.
 *
 * Recharts needs real DOM measurements, so the chart mounts on the client. The
 * server renders the table-equivalent summary above it, which means the page is
 * still readable (and indexable) before hydration.
 */
export function GrowthChart({
  points,
  targetWeightG,
  unit = "g / fish",
}: {
  points: TelemetryPoint[];
  targetWeightG: number | null;
  unit?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const samples = points
    .filter((point) => point.sampleAvgWeightG !== null)
    .map((point) => ({
      date: point.logDate,
      label: new Date(`${point.logDate}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      weight: Number(point.sampleAvgWeightG),
      target: targetWeightG,
    }));

  const feedSeries = points
    .filter((point) => point.feedKg !== null)
    .map((point) => ({
      date: point.logDate,
      label: new Date(`${point.logDate}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      feed: Number(point.feedKg),
    }));

  if (samples.length === 0 && feedSeries.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-porcelain px-4 py-8 text-center">
        <p className="text-[0.82rem] font-semibold text-ink-deep">No growth samples recorded yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[0.75rem] leading-5 text-ink-mute">
          The chart draws itself from the operator&apos;s own field entries — sampled weights, feed
          consumed and mortality counts. Nothing is estimated on the farm&apos;s behalf.
        </p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="grid h-[16rem] place-items-center rounded-xl border border-hairline bg-porcelain">
        <p className="fig text-[0.75rem] text-ink-mute">
          {samples.length} sample{samples.length === 1 ? "" : "s"} · {feedSeries.length} feed entr
          {feedSeries.length === 1 ? "y" : "ies"} ready
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-[17rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={samples} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              unit="g"
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                fontSize: 12,
                fontFamily: "Roboto Mono, monospace",
              }}
              formatter={(value: number) => [`${number(value, 0)} g`, "Sampled weight"]}
              labelFormatter={(label) => String(label)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {targetWeightG ? (
              <ReferenceLine
                y={targetWeightG}
                stroke="#10b981"
                strokeDasharray="6 4"
                label={{
                  value: `Target ${number(targetWeightG, 0)} g`,
                  fontSize: 10,
                  fill: "#059669",
                  position: "insideTopRight",
                }}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="weight"
              name={`Sampled weight (${unit})`}
              stroke="#0891b2"
              strokeWidth={2.4}
              dot={{ r: 3, fill: "#22d3ee" }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {feedSeries.length > 0 ? (
        <div className="h-[11rem] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={feedSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  fontFamily: "Roboto Mono, monospace",
                }}
                formatter={(value: number) => [`${number(value, 1)} kg`, "Feed logged"]}
              />
              <Line
                type="monotone"
                dataKey="feed"
                name="Feed consumption (kg)"
                stroke="#0a1a30"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "#0a1a30" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <p className="text-[0.68rem] text-ink-mute">
        Latest sample {samples.length ? dateLabel(samples[samples.length - 1]?.date ?? null) : "—"}{" "}
        · every point below is an operator entry, approved by an admin.
      </p>
    </div>
  );
}
