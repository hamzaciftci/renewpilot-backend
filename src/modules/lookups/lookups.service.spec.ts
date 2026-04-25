import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { LookupsService } from './lookups.service';

// We mock the global fetch — Node 18+ has it, Jest doesn't stub it for us.
const realFetch = global.fetch;

describe('LookupsService', () => {
  let service: LookupsService;

  beforeEach(() => {
    service = new LookupsService();
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.clearAllMocks();
  });

  // ── Domain validation ──────────────────────────────────────────────────

  describe('domain validation', () => {
    it('rejects empty input', async () => {
      await expect(service.whois('')).rejects.toThrow(BadRequestException);
    });

    it('rejects garbage input', async () => {
      await expect(service.whois('!!notadomain')).rejects.toThrow(BadRequestException);
    });

    it('strips protocol, www., trailing dot/path', async () => {
      const fakeFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ events: [], entities: [] }),
      });
      global.fetch = fakeFetch as unknown as typeof fetch;

      const result = await service.whois('https://www.Example.COM/path?x=1');
      expect(result.domain).toBe('example.com');
      // The URL passed to fetch should reflect the normalized domain.
      expect(fakeFetch).toHaveBeenCalledWith(
        expect.stringContaining('example.com'),
        expect.any(Object),
      );
    });
  });

  // ── RDAP parsing ───────────────────────────────────────────────────────

  describe('RDAP response parsing', () => {
    it('extracts expiration / registration / registrar', async () => {
      const rdapBody = {
        ldhName: 'example.com',
        events: [
          { eventAction: 'registration', eventDate: '1995-08-13T04:00:00Z' },
          { eventAction: 'expiration', eventDate: '2026-08-13T04:00:00Z' },
        ],
        entities: [
          {
            roles: ['registrar'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['fn', {}, 'text', 'GoDaddy.com, LLC'],
              ],
            ],
          },
        ],
        status: ['client transfer prohibited'],
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => rdapBody,
      }) as unknown as typeof fetch;

      const result = await service.whois('example.com');
      expect(result.expiresAt).toBe('2026-08-13');
      expect(result.registeredAt).toBe('1995-08-13');
      expect(result.registrar).toBe('GoDaddy.com, LLC');
      expect(result.status).toEqual(['client transfer prohibited']);
      expect(result.source).toBe('rdap.org');
    });

    it('returns nulls when fields are absent', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ldhName: 'example.com' }),
      }) as unknown as typeof fetch;

      const result = await service.whois('example.com');
      expect(result.expiresAt).toBeNull();
      expect(result.registeredAt).toBeNull();
      expect(result.registrar).toBeNull();
      expect(result.status).toEqual([]);
    });
  });

  // ── Error mapping ──────────────────────────────────────────────────────

  describe('upstream error handling', () => {
    it('maps 404 to NotFoundException', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as unknown as typeof fetch;
      await expect(service.whois('does-not-exist.example')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('maps a 500 to BadGatewayException', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof fetch;
      await expect(service.whois('example.com')).rejects.toThrow(BadGatewayException);
    });

    it('maps a network failure to BadGatewayException', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
      global.fetch = global.fetch as unknown as typeof fetch;
      await expect(service.whois('example.com')).rejects.toThrow(BadGatewayException);
    });

    it('maps non-JSON body to BadGatewayException', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      }) as unknown as typeof fetch;
      await expect(service.whois('example.com')).rejects.toThrow(BadGatewayException);
    });
  });

  // ── Caching ────────────────────────────────────────────────────────────

  describe('caching', () => {
    it('does not refetch within the cache window', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ events: [], entities: [] }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      await service.whois('example.com');
      await service.whois('example.com');
      await service.whois('EXAMPLE.com'); // case-insensitive cache
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
