import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitationStatus, MemberRole } from '@prisma/client';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../common/db/prisma.service';
import { NotificationDispatcherService } from '../notifications/dispatchers/notification-dispatcher.service';
import { buildInvitationEmail } from '../notifications/templates/invitation.template';
import { CreateInvitationDto } from './dto/create-invitation.dto';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  /** SHA-256 of the raw token (only hash stored in DB). */
  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** Generate a new random URL-safe token (raw) + its hash. */
  private generateToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(32).toString('hex'); // 64 chars
    return { raw, hash: this.hashToken(raw) };
  }

  async create(orgId: string, invitedByUserId: string, dto: CreateInvitationDto) {
    const email = dto.email.trim().toLowerCase();
    const role = dto.role ?? MemberRole.MEMBER;

    // Block OWNER via invitation
    if (role === MemberRole.OWNER) {
      throw new ForbiddenException('Davet yoluyla OWNER rolü atanamaz');
    }

    // If user with this email already exists AND is already a member → conflict
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: existingUser.id } },
      });
      if (membership) {
        throw new ConflictException('Bu kullanıcı zaten organizasyon üyesi');
      }
    }

    // Block duplicate PENDING invite for same email+org
    const duplicate = await this.prisma.invitation.findFirst({
      where: {
        organizationId: orgId,
        email,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });
    if (duplicate) {
      throw new ConflictException('Bu e-posta için bekleyen bir davet zaten var');
    }

    const { raw, hash } = this.generateToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const [invitation, org, inviter] = await this.prisma.$transaction([
      this.prisma.invitation.create({
        data: {
          organizationId: orgId,
          email,
          role,
          tokenHash: hash,
          invitedByUserId,
          expiresAt,
        },
      }),
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: invitedByUserId },
        select: { id: true, email: true, fullName: true },
      }),
    ]);

    // Dispatch the invite email (fire-and-forget via dispatcher; errors logged but don't block response)
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://renewpilot.vercel.app';
    const acceptUrl = `${frontendUrl.replace(/\/$/, '')}/invite/${raw}`;

    try {
      const emailContent = buildInvitationEmail({
        inviterName: inviter?.fullName ?? 'Bir takım üyesi',
        inviterEmail: inviter?.email ?? '',
        organizationName: org?.name ?? 'Organizasyon',
        role,
        acceptUrl,
        expiresAt: expiresAt.toISOString(),
      });

      await this.dispatcher.dispatch({
        channel: 'EMAIL',
        to: { email },
        subject: emailContent.subject,
        html: emailContent.html,
        body: emailContent.text,
      });
    } catch (err: any) {
      this.logger.error(`Davet e-postası gönderilemedi: ${err?.message ?? err}`);
      // Don't throw — invitation record exists, admin can resend
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      // Only returned on creation for admin debugging / manual copy-paste
      acceptUrl,
    };
  }

  async listForOrg(orgId: string) {
    const invites = await this.prisma.invitation.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return invites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      acceptedAt: inv.acceptedAt?.toISOString() ?? null,
      revokedAt: inv.revokedAt?.toISOString() ?? null,
    }));
  }

  async revoke(orgId: string, invitationId: string) {
    const inv = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!inv) throw new NotFoundException('Davet bulunamadı');
    if (inv.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Sadece bekleyen davetler iptal edilebilir');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    return { message: 'Davet iptal edildi' };
  }

  async resend(orgId: string, invitationId: string, actorUserId: string) {
    const inv = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
      include: { organization: { select: { name: true } } },
    });
    if (!inv) throw new NotFoundException('Davet bulunamadı');
    if (inv.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Sadece bekleyen davetler tekrar gönderilebilir');
    }

    // Rotate token on resend — invalidates the old link
    const { raw, hash } = this.generateToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { tokenHash: hash, expiresAt },
    });

    const inviter = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { email: true, fullName: true },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://renewpilot.vercel.app';
    const acceptUrl = `${frontendUrl.replace(/\/$/, '')}/invite/${raw}`;

    const emailContent = buildInvitationEmail({
      inviterName: inviter?.fullName ?? 'Bir takım üyesi',
      inviterEmail: inviter?.email ?? '',
      organizationName: inv.organization?.name ?? 'Organizasyon',
      role: inv.role,
      acceptUrl,
      expiresAt: expiresAt.toISOString(),
    });

    await this.dispatcher.dispatch({
      channel: 'EMAIL',
      to: { email: inv.email },
      subject: emailContent.subject,
      html: emailContent.html,
      body: emailContent.text,
    });

    return { message: 'Davet tekrar gönderildi', expiresAt: expiresAt.toISOString(), acceptUrl };
  }

  /**
   * Public: fetch invitation details by raw token.
   * No auth required — the token itself is the secret.
   */
  async getByToken(rawToken: string) {
    const hash = this.hashToken(rawToken);
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: hash },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!inv) throw new NotFoundException('Davet bulunamadı veya bağlantı geçersiz');

    // Auto-expire if past expiresAt
    if (inv.status === InvitationStatus.PENDING && inv.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: inv.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      inv.status = InvitationStatus.EXPIRED;
    }

    const inviter = await this.prisma.user.findUnique({
      where: { id: inv.invitedByUserId },
      select: { fullName: true, email: true },
    });

    return {
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
      organization: inv.organization,
      inviter: inviter ? { fullName: inviter.fullName, email: inviter.email } : null,
    };
  }

  /**
   * Authenticated: accept the invitation.
   * The logged-in user's email must match the invitation email.
   */
  async accept(rawToken: string, userId: string) {
    const hash = this.hashToken(rawToken);
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: hash },
    });
    if (!inv) throw new NotFoundException('Davet bulunamadı');

    // Validate state
    if (inv.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('Bu davet zaten kabul edilmiş');
    }
    if (inv.status === InvitationStatus.REVOKED) {
      throw new BadRequestException('Bu davet iptal edilmiş');
    }
    if (inv.status === InvitationStatus.EXPIRED || inv.expiresAt < new Date()) {
      if (inv.status !== InvitationStatus.EXPIRED) {
        await this.prisma.invitation.update({
          where: { id: inv.id },
          data: { status: InvitationStatus.EXPIRED },
        });
      }
      throw new BadRequestException('Bu davetin süresi dolmuş');
    }

    // Fetch user and ensure email match
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
      throw new ForbiddenException(
        `Bu davet ${inv.email} adresine gönderilmiş. Lütfen o hesapla giriş yapın.`,
      );
    }

    // Check if already a member (race condition safety)
    const existing = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: inv.organizationId, userId } },
    });

    if (!existing) {
      await this.prisma.organizationMember.create({
        data: {
          organizationId: inv.organizationId,
          userId,
          role: inv.role,
          invitedByUserId: inv.invitedByUserId,
          invitedAt: inv.createdAt,
          joinedAt: new Date(),
        },
      });
    }

    await this.prisma.invitation.update({
      where: { id: inv.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
        acceptedByUserId: userId,
      },
    });

    return {
      message: 'Davet kabul edildi. Organizasyona eklendiniz.',
      organizationId: inv.organizationId,
    };
  }
}
