import { Icon } from "@/components/icon";

const PLACEHOLDER_METRICS = [
  { label: "Clicks", value: "—", icon: "ads_click" },
  { label: "Impressions", value: "—", icon: "visibility" },
  { label: "Avg. CTR", value: "—", icon: "percent" },
  { label: "Avg. position", value: "—", icon: "leaderboard" },
];

export default function SearchConsolePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Search console</h2>
        <p className="text-sm text-ink-muted">
          Google Search Console performance for this property.
        </p>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-status-progress-text/20 bg-status-progress-bg/40 p-4">
        <Icon name="info" className="text-status-progress-text" />
        <div>
          <p className="text-sm font-medium text-status-progress-text">
            Not connected — placeholder data
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Wiring real Google Search Console data requires OAuth and a service
            account. This is a separate integration step; the figures below are
            intentionally blank.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {PLACEHOLDER_METRICS.map((m) => (
          <div key={m.label} className="card p-4">
            <div className="mb-2 flex items-center gap-2 text-ink-subtle">
              <Icon name={m.icon} size={18} />
              <span className="text-xs font-medium uppercase tracking-wide">
                {m.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-ink-subtle">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="card mt-4 flex h-64 flex-col items-center justify-center text-center">
        <Icon name="bar_chart" size={32} className="mb-2 text-ink-subtle" />
        <p className="text-sm text-ink-subtle">
          Performance chart will appear here once connected.
        </p>
      </div>
    </div>
  );
}
