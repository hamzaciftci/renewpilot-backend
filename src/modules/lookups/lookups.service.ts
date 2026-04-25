import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

/**
 * RDAP (Registration Data Access Protocol) lookups for domain expiry detection.
 *
 * RDAP is the JSON-based successor to WHOIS — it returns a structured
 * `events` array including registration / expiration timestamps. We proxy
 * through https://rdap.org which routes to the correct registry RDAP server
 * for each TLD, so we don't have to maintain an IANA TLD bootstrap table.
 *
 * Cache: in-memory, 6 hours. Domain expiry doesn't change minute-to-minute,
 * and we don't want to hammer rdap.org if a user clicks "detect" repeatedly.
 *
 * If rdap.org is ever down we 502 with a friendly message — the user can
 * still type the date in manually.
 */
export interface WhoisLookupResult {
  /** Canonical domain (lowercased, trimmed). */
  domain: string;
  /** ISO date string of expiration, e.g. "2026-08-13". null when unknown. */
  expiresAt: string | null;
  /** ISO date string of registration, e.g. "1995-08-13". null when unknown. */
  registeredAt: string | null;
  /** Registrar / sponsor name, e.g. "GoDaddy.com, LLC". null when unknown. */
  registrar: string | null;
  /** RDAP `status` array, e.g. ["client transfer prohibited"]. */
  status: string[];
  /** Source server we consulted. Useful for debugging. */
  source: string;
}

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: unknown[];
  publicIds?: { type?: string; identifier?: string }[];
}

interface RdapResponse {
  ldhName?: string;
  unicodeName?: string;
  events?: RdapEvent[];
  entities?: RdapEntity[];
  status?: string[];
  errorCode?: number;
  title?: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FETCH_TIMEOUT_MS = 8000;
const RDAP_BASE = 'https://rdap.org/domain/';

/**
 * Bare-bones host validation. We accept ASCII labels separated by dots
 * (a-z, 0-9, hyphens, no leading/trailing hyphen per label, 1–63 chars
 * each, total up to 253 chars). IDN punycode (xn--…) passes naturally.
 *
 * NB: this is intentionally stricter than the URL parser — we don't want
 * users typing "https://example.com/path" and getting a successful lookup
 * for the wrong thing.
 */
const DOMAIN_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

@Injectable()
export class LookupsService {
  private readonly log = new Logger(LookupsService.name);
  private readonly cache = new Map<
    string,
    { result: WhoisLookupResult; expiresAt: number }
  >();

  /**
   * Look up domain expiry / registrar via RDAP.
   * @throws BadRequestException for invalid domains
   * @throws NotFoundException when registry has no record
   * @throws BadGatewayException when the upstream RDAP server fails
   */
  async whois(rawDomain: string): Promise<WhoisLookupResult> {
    const domain = this.normalizeDomain(rawDomain);

    // Cache hit
    const cached = this.cache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const url = RDAP_BASE + encodeURIComponent(domain);
    let res: Response;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        res = await fetch(url, {
          headers: { Accept: 'application/rdap+json, application/json' },
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      this.log.warn(`RDAP fetch failed for ${domain}: ${(err as Error).message}`);
      throw new BadGatewayException('Lookup service unreachable');
    }

    if (res.status === 404) {
      throw new NotFoundException(`No registry record for ${domain}`);
    }
    if (!res.ok) {
      this.log.warn(`RDAP non-OK ${res.status} for ${domain}`);
      throw new BadGatewayException(`Lookup upstream returned ${res.status}`);
    }

    let body: RdapResponse;
    try {
      body = (await res.json()) as RdapResponse;
    } catch {
      throw new BadGatewayException('Lookup upstream returned non-JSON');
    }

    if (body.errorCode === 404) {
      throw new NotFoundException(`No registry record for ${domain}`);
    }

    const result = this.parseRdap(domain, body);
    this.cache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private normalizeDomain(raw: string): string {
    if (!raw || typeof raw !== 'string') {
      throw new BadRequestException('Domain is required');
    }
    let s = raw.trim().toLowerCase();
    // Strip protocol if user pasted a URL
    s = s.replace(/^https?:\/\//, '');
    // Strip trailing path / port / query
    s = s.split('/')[0]?.split(':')[0] ?? '';
    // Strip leading "www." — RDAP works on the registered domain
    s = s.replace(/^www\./, '');
    // Strip trailing dot
    s = s.replace(/\.$/, '');

    if (!DOMAIN_RE.test(s)) {
      throw new BadRequestException(`"${raw}" is not a valid domain name`);
    }
    return s;
  }

  private parseRdap(domain: string, body: RdapResponse): WhoisLookupResult {
    const events = Array.isArray(body.events) ? body.events : [];
    const findEvent = (action: string) =>
      events.find(
        (e) => typeof e?.eventAction === 'string' && e.eventAction.toLowerCase() === action,
      )?.eventDate ?? null;

    const expiration = findEvent('expiration');
    const registration = findEvent('registration');

    let registrar: string | null = null;
    if (Array.isArray(body.entities)) {
      const reg = body.entities.find(
        (e) => Array.isArray(e?.roles) && e.roles.includes('registrar'),
      );
      if (reg) {
        // vcardArray is the awkward jCard format: ["vcard", [["fn", {}, "text", "GoDaddy"], ...]]
        const vcard = reg.vcardArray;
        if (Array.isArray(vcard) && Array.isArray(vcard[1])) {
          const props = vcard[1] as unknown[];
          for (const prop of props) {
            if (Array.isArray(prop) && prop[0] === 'fn' && typeof prop[3] === 'string') {
              registrar = prop[3] as string;
              break;
            }
          }
        }
      }
    }

    return {
      domain,
      expiresAt: this.toIsoDate(expiration),
      registeredAt: this.toIsoDate(registration),
      registrar,
      status: Array.isArray(body.status) ? body.status : [],
      source: 'rdap.org',
    };
  }

  /** RDAP timestamps come in mixed precision — we just return YYYY-MM-DD. */
  private toIsoDate(raw: string | null): string | null {
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
