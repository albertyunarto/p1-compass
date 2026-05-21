// Lightweight, dependency-free event tracking.
//
// When NEXT_PUBLIC_POSTHOG_KEY is set, custom events are sent to PostHog's
// capture endpoint. Without a key every call is a no-op.

let distinctId: string | null = null;

function getDistinctId(): string {
  if (distinctId) return distinctId;
  try {
    const stored = localStorage.getItem("p1c_id");
    if (stored) {
      distinctId = stored;
    } else {
      distinctId = crypto.randomUUID();
      localStorage.setItem("p1c_id", distinctId);
    }
  } catch {
    distinctId = "anonymous";
  }
  return distinctId;
}

export function track(
  event: string,
  properties: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

  try {
    fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: getDistinctId(),
        properties: { ...properties, $current_url: window.location.href },
      }),
    }).catch(() => {});
  } catch {
    // tracking must never break the app
  }
}
