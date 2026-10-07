import { useEffect, useState } from "react";
import { CloudRain, Droplets, Satellite, Sun, ThermometerSun } from "lucide-react";

import { FARM_SITE } from "@/lib/ndh/ecosystem";
import { number } from "@/lib/agri/format";

type Forecast = {
  current?: { temperature_2m?: number; relative_humidity_2m?: number; precipitation?: number };
  daily?: {
    time?: string[];
    precipitation_sum?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    relative_humidity_2m_mean?: number[];
  };
};

type LoggedWeather = {
  capturedOn: string;
  rainfallMm: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  humidityPercent: number | null;
};

/**
 * Local climate for the farm site.
 *
 * Two sources, in priority order: the live Open-Meteo forecast for the site's
 * coordinates, and the operator's own logged field observations. If the
 * forecast service is unreachable the panel falls back to the field record
 * rather than showing invented numbers.
 */
export function ClimatePanel({ logged }: { logged: LoggedWeather[] }) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [state, setState] = useState<"loading" | "live" | "fallback">("loading");

  useEffect(() => {
    let cancelled = false;
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${FARM_SITE.latitude}` +
      `&longitude=${FARM_SITE.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation` +
      `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean` +
      `&timezone=Africa%2FLagos&forecast_days=5`;

    fetch(url)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("offline"))))
      .then((payload: Forecast) => {
        if (cancelled) return;
        setForecast(payload);
        setState("live");
      })
      .catch(() => {
        if (!cancelled) setState("fallback");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const daily = forecast?.daily;
  const days = (daily?.time ?? []).slice(0, 5);
  const latestLog = logged[0];

  return (
    <div className="pg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <div>
          <p className="pg-kicker">Farm site climate</p>
          <p className="mt-0.5 text-[0.82rem] font-semibold text-ink-deep">{FARM_SITE.label}</p>
        </div>
        <span className={`pg-chip ${state === "live" ? "pg-chip--signal" : "pg-chip--amber"}`}>
          <Satellite size={11} aria-hidden="true" />
          {state === "live"
            ? "Live forecast"
            : state === "loading"
              ? "Connecting…"
              : "Field record"}
        </span>
      </div>

      {state === "live" && forecast?.current ? (
        <>
          <div className="grid grid-cols-3 divide-x divide-hairline border-b border-hairline">
            <Metric
              icon={<ThermometerSun size={14} />}
              label="Now"
              value={`${number(forecast.current.temperature_2m ?? 0, 1)}°C`}
            />
            <Metric
              icon={<Droplets size={14} />}
              label="Humidity"
              value={`${number(forecast.current.relative_humidity_2m ?? 0, 0)}%`}
            />
            <Metric
              icon={<CloudRain size={14} />}
              label="Rain now"
              value={`${number(forecast.current.precipitation ?? 0, 1)} mm`}
            />
          </div>

          <div className="table-scroll">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="num">Rain</th>
                  <th className="num">Low</th>
                  <th className="num">High</th>
                  <th className="num">Humidity</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day, index) => (
                  <tr key={day}>
                    <td className="whitespace-nowrap font-medium text-ink-deep">
                      {new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="num fig">
                      {number(daily?.precipitation_sum?.[index] ?? 0, 1)} mm
                    </td>
                    <td className="num fig">
                      {number(daily?.temperature_2m_min?.[index] ?? 0, 1)}°
                    </td>
                    <td className="num fig">
                      {number(daily?.temperature_2m_max?.[index] ?? 0, 1)}°
                    </td>
                    <td className="num fig">
                      {number(daily?.relative_humidity_2m_mean?.[index] ?? 0, 0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : state === "fallback" && latestLog ? (
        <div className="grid grid-cols-2 divide-x divide-hairline">
          <Metric
            icon={<CloudRain size={14} />}
            label={`Rainfall · ${latestLog.capturedOn}`}
            value={latestLog.rainfallMm === null ? "—" : `${number(latestLog.rainfallMm, 1)} mm`}
          />
          <Metric
            icon={<Droplets size={14} />}
            label="Humidity"
            value={
              latestLog.humidityPercent === null ? "—" : `${number(latestLog.humidityPercent, 0)}%`
            }
          />
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-5">
          <Sun size={16} className="mt-0.5 shrink-0 text-amber-alert" aria-hidden="true" />
          <p className="text-[0.78rem] leading-5 text-ink-soft">
            No climate reading yet. The farm operator records rainfall, temperature and humidity
            from the field, and those observations appear here as soon as the first log is approved.
          </p>
        </div>
      )}

      {state === "live" && latestLog ? (
        <p className="border-t border-hairline bg-porcelain px-4 py-2 text-[0.68rem] text-ink-mute">
          Last field observation: {latestLog.capturedOn}
          {latestLog.rainfallMm !== null ? ` · ${number(latestLog.rainfallMm, 1)} mm rainfall` : ""}
          {latestLog.tempMaxC !== null ? ` · high ${number(latestLog.tempMaxC, 1)}°C` : ""}
        </p>
      ) : null}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="pg-kicker flex items-center gap-1.5">
        <span className="text-signal-deep">{icon}</span>
        {label}
      </p>
      <p className="fig mt-1 text-[1.05rem] font-semibold text-ink-deep">{value}</p>
    </div>
  );
}
