import type { V2Envelope } from "../domain/types";
import explorerFixture from "./fixtures/explorer.json";
import signalsFixture from "./fixtures/signals-top.json";
import signalsVelocityFixture from "./fixtures/signals-velocity.json";
import globeFixture from "./fixtures/globe.json";

export const KOSMOS_BASE_URL = "https://api.kosmos.fyi";

const FIXTURE_TABLE: Record<string, unknown> = {
  "/api/v2/explorer/overview": explorerFixture,
  "/api/v2/signals?sort=top&limit=100": signalsFixture,
  "/api/v2/signals?sort=velocity&limit=25": signalsVelocityFixture,
  "/api/v2/globe/activity?limit=100": globeFixture,
};

function shouldUseFixtures(): boolean {
  const raw = process.env.EXPO_PUBLIC_USE_FIXTURES;
  if (raw == null) {
    return true;
  }
  return raw.toLowerCase() !== "false";
}

export class KosmosApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "KosmosApiError";
    this.code = code;
    this.status = status;
  }
}

export async function fetchKosmos<T>(path: string): Promise<T> {
  if (shouldUseFixtures()) {
    const fixture = FIXTURE_TABLE[path];
    if (fixture === undefined) {
      throw new KosmosApiError(
        `No fixture registered for ${path}. Set EXPO_PUBLIC_USE_FIXTURES=false to hit live API.`,
        "fixture_missing",
        0,
      );
    }
    const env = fixture as V2Envelope<T>;
    if (env.error) {
      throw new KosmosApiError(env.error.message, env.error.code, 0);
    }
    return env.data;
  }
  const url = `${KOSMOS_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new KosmosApiError(
      `HTTP ${res.status} from ${path}`,
      "http_error",
      res.status,
    );
  }
  const env = (await res.json()) as V2Envelope<T>;
  if (env.error) {
    throw new KosmosApiError(env.error.message, env.error.code, res.status);
  }
  return env.data;
}

export function isUsingFixtures(): boolean {
  return shouldUseFixtures();
}
