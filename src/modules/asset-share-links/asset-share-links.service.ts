import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../common/db/prisma.service';
import { CreateAssetShareLinkDto } from './dto/create-asset-share-link.dto';

/**
 * Read-only public share links for a single asset.
 *
 * Token storage rules (mirrors Invitations):
 *   - The plaintext URL token is generated server-side and returned ONCE on
 *     creation. We never store it.
 *   - Only the SHA-256 hash is persisted in `asset_share_links.token_hash`.
 *   - Public lookups hash the URL token and match against `token_hash`.
 *
 * Revocation = setting `revokedAt`. We don't delete the row so we can keep
 * audit trail (view count, who created it, when).
 */
@Injectable()
export class AssetShareLinksService {
  private readonly logger = new Logger(AssetShareLinksService.name);

  constructor(private readonly prisma: PrismaService) {}

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private generateToken(): { raw: string; hash: string } {
    // 32 bytes => 43-char URL-safe base64 (no padding). Plenty of entropy and
    // short enough to fit in QR codes / chat messages without wrapping.
    const raw = crypto.randomBytes(32).toString('base64url');
    return { raw, hash: this.hashToken(raw) };
  }

  /**
   * Confirm the asset belongs to the org. Throws 404 if missing or wrong org —
   * deliberately not 403 so we don't leak existence of assets in other orgs.
   */
  private async assertAssetInOrg(orgId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
  }

  async create(
    orgId: string,
    assetId: string,
    userId: string,
    dto: CreateAssetShareLinkDto,
  ) {
    await this.assertAssetInOrg(orgId, assetId);

    if (dto.expiresAt && dto.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException('expiresAt must be in the future');
    }

    const { raw, hash } = this.generateToken();

    const link = await this.prisma.assetShareLink.create({
      data: {
        assetId,
        tokenHash: hash,
        label: dto.label,
        createdByUserId: userId,
        expiresAt: dto.expiresAt,
      },
    });

    // Plaintext token returned once — caller must persist or expose it now.
    return {
      id: link.id,
      label: link.label,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
      token: raw,
    };
  }

  /** List share links for an asset. Excludes the plaintext token. */
  async list(orgId: string, assetId: string) {
    await this.assertAssetInOrg(orgId, assetId);

    return this.prisma.assetShareLink.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        expiresAt: true,
        revokedAt: true,
        viewCount: true,
        lastViewedAt: true,
        createdAt: true,
        createdByUserId: true,
        createdBy: { select: { fullName: true, email: true } },
      },
    });
  }

  async revoke(orgId: string, assetId: string, linkId: string) {
    await this.assertAssetInOrg(orgId, assetId);

    const link = await this.prisma.assetShareLink.findFirst({
      where: { id: linkId, assetId },
    });
    if (!link) throw new NotFoundException('Share link not found');
    if (link.revokedAt) return { id: link.id, revokedAt: link.revokedAt };

    const updated = await this.prisma.assetShareLink.update({
      where: { id: link.id },
      data: { revokedAt: new Date() },
      select: { id: true, revokedAt: true },
    });
    return updated;
  }

  /**
   * Public lookup. Returns a sanitized payload — only the renewal-relevant
   * info, not internal fields like createdByUserId, projectId, etc.
   *
   * Throws NotFound for: missing token, revoked link, expired link, or
   * deleted asset. We deliberately use the same 404 for all of these so
   * brute-forcing tokens can't distinguish "wrong" from "expired".
   */
  async resolveByToken(rawToken: string) {
    const hash = this.hashToken(rawToken);
    const link = await this.prisma.assetShareLink.findUnique({
      where: { tokenHash: hash },
      include: {
        asset: {
          include: {
            organization: { select: { name: true } },
            domain: true,
            sslCertificate: true,
            license: true,
            hostingService: true,
            cdnService: true,
            server: true,
          },
        },
      },
    });

    const NOT_FOUND = new NotFoundException('Share link not found or expired');

    if (!link) throw NOT_FOUND;
    if (link.revokedAt) throw NOT_FOUND;
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) throw NOT_FOUND;
    if (!link.asset || link.asset.deletedAt) throw NOT_FOUND;

    // Increment counters (best-effort — don't fail the request if this errors)
    this.prisma.assetShareLink
      .update({
        where: { id: link.id },
        data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
      })
      .catch((err) => this.logger.warn(`Failed to bump view count: ${err.message}`));

    const a = link.asset;
    return {
      label: link.label,
      organizationName: a.organization.name,
      asset: {
        name: a.name,
        assetType: a.assetType,
        vendorName: a.vendorName,
        renewalDate: a.renewalDate,
        renewalIntervalUnit: a.renewalIntervalUnit,
        renewalIntervalValue: a.renewalIntervalValue,
        status: a.status,
        priceAmount: a.priceAmount,
        priceCurrency: a.priceCurrency,
        notes: a.notes,
        // Subtype details — only the fields a non-owner viewer needs to know.
        domain: a.domain
          ? {
              domainName: a.domain.domainName,
              registrar: a.domain.registrar,
              autoRenew: a.domain.autoRenew,
            }
          : null,
        sslCertificate: a.sslCertificate
          ? {
              commonName: a.sslCertificate.commonName,
              issuer: a.sslCertificate.issuer,
              validTo: a.sslCertificate.validTo,
            }
          : null,
        license: a.license
          ? {
              softwareName: a.license.softwareName,
              licenseType: a.license.licenseType,
              seatCount: a.license.seatCount,
              // licenseKey deliberately omitted — secret.
            }
          : null,
        hostingService: a.hostingService
          ? {
              provider: a.hostingService.provider,
              planName: a.hostingService.planName,
            }
          : null,
        cdnService: a.cdnService
          ? {
              provider: a.cdnService.provider,
              planName: a.cdnService.planName,
            }
          : null,
        server: a.server
          ? {
              provider: a.server.provider,
              hostname: a.server.hostname,
              region: a.server.region,
              // ipAddress deliberately omitted — internal info.
            }
          : null,
      },
    };
  }
}
