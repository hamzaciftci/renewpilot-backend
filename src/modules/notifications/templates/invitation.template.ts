export interface InvitationEmailData {
  inviterName: string;
  inviterEmail: string;
  organizationName: string;
  role: string;
  acceptUrl: string;
  expiresAt: string; // ISO
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Sahip',
  ADMIN: 'Yönetici',
  MEMBER: 'Üye',
  VIEWER: 'Görüntüleyici',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildInvitationEmail(data: InvitationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { inviterName, inviterEmail, organizationName, role, acceptUrl, expiresAt } = data;
  const roleLabel = ROLE_LABEL[role] ?? role;

  const subject = `${inviterName} sizi "${organizationName}" takımına davet etti`;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);max-width:600px;">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 32px 24px;color:#ffffff;">
              <div style="font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">RenewPilot</div>
              <div style="font-size:22px;font-weight:700;margin-top:8px;">Takım Daveti</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="font-size:16px;color:#18181b;margin:0 0 16px;line-height:1.5;">
                <strong>${inviterName}</strong>
                <span style="color:#71717a;">(${inviterEmail})</span>
                sizi <strong>${organizationName}</strong> takımına
                <strong style="color:#6366f1;">${roleLabel}</strong> olarak davet etti.
              </p>
              <p style="font-size:14px;color:#52525b;margin:0 0 24px;line-height:1.6;">
                RenewPilot, alan adı/sunucu/SSL gibi yenilemeleri kaçırmadan yönetmeniz için kurulmuş bir platformdur. Takıma katılarak ${organizationName} organizasyonunun tüm varlıklarını görüntüleyebilir ve rolünüze bağlı olarak yönetebilirsiniz.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
                <tr>
                  <td style="background:#6366f1;border-radius:8px;">
                    <a href="${acceptUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
                      Daveti Kabul Et →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:12px;color:#71717a;margin:24px 0 0;line-height:1.5;">
                Bu davet <strong>${formatDate(expiresAt)}</strong> tarihine kadar geçerlidir.
              </p>
              <p style="font-size:12px;color:#a1a1aa;margin:8px 0 0;line-height:1.5;word-break:break-all;">
                Buton çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:<br />
                <span style="color:#6366f1;">${acceptUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa;padding:16px 32px;text-align:center;border-top:1px solid #e4e4e7;">
              <p style="font-size:11px;color:#a1a1aa;margin:0;line-height:1.5;">
                Bu daveti beklemiyorsanız bu e-postayı güvenle yok sayabilirsiniz. Davet sadece yukarıdaki bağlantı üzerinden kabul edilebilir.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${inviterName} (${inviterEmail}) sizi "${organizationName}" takımına ${roleLabel} olarak davet etti.

Daveti kabul etmek için bu bağlantıya tıklayın:
${acceptUrl}

Bu davet ${formatDate(expiresAt)} tarihine kadar geçerlidir.

— RenewPilot`;

  return { subject, html, text };
}
