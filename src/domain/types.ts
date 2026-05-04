export type Category = "geopolitics" | "economics" | "health" | "other";

export type LatLng = {
  lat: number;
  lng: number;
};

export type V2Envelope<T> = {
  data: T;
  meta: {
    api_version?: string;
    request_id?: string;
    generated_at?: string;
    pagination?: { next_cursor?: string | null } | null;
    freshness?: { generated_ms?: number };
    warnings?: string[];
  };
  error: null | { code: string; message: string };
};

export type XVolume = {
  one_hour?: number;
  twenty_four_hour?: number;
  previous_twenty_four_hour?: number;
  delta?: number;
  delta_pct?: number;
  updated_at?: string;
};

export type SignalCounts = {
  evidence?: number;
  markets?: number;
  primary_markets?: number;
  sources?: number;
  evidence_types?: number;
  discussions?: number;
};

export type MarketSnapshot = {
  id: string;
  title?: string;
  [key: string]: unknown;
};

export type Evidence = {
  id?: string;
  source?: string;
  title?: string;
  url?: string;
  published_at?: string;
  type?: string;
  [key: string]: unknown;
};

export type SignalCard = {
  id: string;
  title: string;
  summary: string;
  status: string;
  category: string;
  country: string | null;
  region_group: string | null;
  severity: number;
  confidence: number;
  momentum: number;
  rank_score: number;
  freshness_hours: number;
  counts?: SignalCounts;
  x_volume?: XVolume;
  canonical_signal_id?: string;
  canonical_cluster_size?: number;
  duplicate_signal_count?: number;
  is_canonical_duplicate?: boolean;
  primary_market?: MarketSnapshot | null;
  markets_preview?: MarketSnapshot[];
  top_evidence?: Evidence[];
  top_twitter_evidence?: Evidence[];
  first_seen_at?: string;
  last_evidence_at?: string;
};

export type GlobeCountry = {
  country: string;
  region_group?: string | null;
  name?: string;
  active_markets?: number;
  active_signals?: number;
  volume_24h?: number;
  heat_score: number;
  top_signal_id?: string | null;
  top_market_id?: string | null;
  updated_at?: string;
  centroid?: LatLng | null;
};

export type SignalsTopResponse = {
  signals: SignalCard[];
};

export type GlobeActivityResponse = {
  countries: GlobeCountry[];
};

export type ExplorerOverviewResponse = {
  stats: {
    active_signals: number;
    active_markets: number;
    evidence_24h: number;
    tweet_evidence_24h: number;
    total_volume_24h: number;
    active_countries: number;
  };
  top_signals: SignalCard[];
  market_movers: MarketSnapshot[];
  top_countries: GlobeCountry[];
  breaking_news: Evidence[];
};

export type NewsEvent = {
  id: string;
  title: string;
  summary: string;
  countryCode: string;
  position: LatLng;
  category: Category;
  severity: number;
  momentum: number;
  freshnessHours: number;
  evidenceCount: number;
  xVolumeDelta: number;
  primaryMarketId: string | null;
  raw: SignalCard;
};

export type CountryHeat = {
  code: string;
  heatScore: number;
};

export type ExplorerStats = {
  activeSignals: number;
  activeMarkets: number;
  evidence24h: number;
  tweetEvidence24h: number;
  totalVolume24h: number;
  activeCountries: number;
};

export type Filters = {
  categories: Category[] | null;
};
