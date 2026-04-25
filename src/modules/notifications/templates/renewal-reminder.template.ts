export interface RenewalReminderData {
  recipientName: string;
  assetName: string;
  assetType: string;
  vendorName?: string | null;
  renewalDate: string; // ISO
  daysUntil: number; // negative = overdue
  price?: string | null;
  dashboardUrl: string;
  metadata?: Record<string, unknown> | null;
}

const ASSET_TYPE_LABEL: Record<string, string> = {
  DOMAIN: 'Alan Adı',
  SERVER: 'Sunucu',
  SSL_CERTIFICATE: 'SSL Sertifikası',
  LICENSE: 'Lisans',
  HOSTING_SERVICE: 'Hosting',
  CDN_SERVICE: 'CDN',
  CREDIT_CARD: 'Kredi Kartı',
  CUSTOM: 'Özel',
};

function isCreditCard(type: string): boolean {
  return type === 'CREDIT_CARD';
}

function formatCreditCardTitle(data: RenewalReminderData): string {
  const last4 = (data.metadata?.last4 as string | undefined) ?? '';
  const bank = (data.metadata?.bankName as string | undefined) ?? data.vendorName ?? '';
  const parts: string[] = [data.assetName];
  if (bank) parts.push(bank);
  if (last4) parts.push(`**** ${last4}`);
  return parts.join(' · ');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getUrgencyInfo(days: number): { level: string; emoji: string; color: string; label: string } {
  if (days < 0) return { level: 'critical', emoji: '🚨', color: '#dc2626', label: `SÜRESİ GEÇTİ (${Math.abs(days)} gün önce)` };
  if (days === 0) return { level: 'critical', emoji: '🚨', color: '#dc2626', label: 'BUGÜN SONA ERİYOR' };
  if (days <= 3) return { level: 'urgent', emoji: '⚠️', color: '#ea580c', label: `${days} gün kaldı — ACİL` };
  if (days <= 7) return { level: 'high', emoji: '⏰', color: '#d97706', label: `${days} gün kaldı` };
  if (days <= 14) return { level: 'medium', emoji: '📌', color: '#2563eb', label: `${days} gün kaldı` };
  return { level: 'low', emoji: '📅', color: '#059669', label: `${days} gün kaldı` };
}

export function renderRenewalReminderEmail(data: RenewalReminderData): { subject: string; text: string; html: string } {
  const urgency = getUrgencyInfo(data.daysUntil);
  const typeLabel = ASSET_TYPE_LABEL[data.assetType] ?? data.assetType;
  const dateStr = formatDate(data.renewalDate);
  const cc = isCreditCard(data.assetType);
  const actionWordInf = cc ? 'ödeme' : 'yenileme';
  const actionVerbPhrase = cc ? 'ödemeniz' : 'yenilemeniz';
  const displayTitle = cc ? formatCreditCardTitle(data) : data.assetName;
  const statementDay = cc ? (data.metadata?.statementDay as number | undefined) : undefined;

  const subject = data.daysUntil < 0
    ? `🚨 ${displayTitle} ${actionWordInf} tarihi geçti (${Math.abs(data.daysUntil)} gün önce)`
    : data.daysUntil === 0
    ? `🚨 ${displayTitle} — son ${actionWordInf} tarihi BUGÜN`
    : `${urgency.emoji} ${displayTitle} — ${data.daysUntil} gün içinde ${actionVerbPhrase} gerekiyor`;

  const text = `Merhaba ${data.recipientName},

${urgency.label}

${cc ? 'Kart' : 'Varlık'}: ${displayTitle}
Tür: ${typeLabel}
${data.vendorName ? `${cc ? 'Banka' : 'Sağlayıcı'}: ${data.vendorName}\n` : ''}${cc ? 'Son Ödeme Tarihi' : 'Yenileme Tarihi'}: ${dateStr}
${statementDay ? `Hesap Kesim Günü: Her ayın ${statementDay}'ı\n` : ''}${data.price ? `Tutar: ${data.price}\n` : ''}

Panel: ${data.dashboardUrl}

— RenewPilot`;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;padding:12px 18px;background:#6366f1;color:#fff;border-radius:10px;font-weight:700;font-size:18px;">RenewPilot</div>
  </div>
  <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.05);">
    <div style="padding:24px;background:${urgency.color};color:#fff;text-align:center;">
      <div style="font-size:36px;margin-bottom:4px;">${urgency.emoji}</div>
      <div style="font-size:14px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;opacity:.95;">${urgency.label}</div>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;color:#111827;font-size:16px;">Merhaba <strong>${data.recipientName}</strong>,</p>
      <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.55;">
        <strong>${displayTitle}</strong> adlı ${typeLabel.toLowerCase()} için ${data.daysUntil < 0 ? `${actionWordInf} tarihi geçti` : data.daysUntil === 0 ? `${actionWordInf} günü bugün` : `${data.daysUntil} gün içinde ${actionWordInf} yapmanız gerekiyor`}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border-radius:10px;overflow:hidden;">
        <tr><td style="padding:12px 16px;color:#6b7280;font-size:13px;width:40%;">${cc ? 'Kart' : 'Varlık'}</td><td style="padding:12px 16px;color:#111827;font-size:14px;font-weight:600;">${displayTitle}</td></tr>
        <tr style="border-top:1px solid #e5e7eb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Tür</td><td style="padding:12px 16px;color:#111827;font-size:14px;">${typeLabel}</td></tr>
        ${data.vendorName ? `<tr style="border-top:1px solid #e5e7eb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">${cc ? 'Banka' : 'Sağlayıcı'}</td><td style="padding:12px 16px;color:#111827;font-size:14px;">${data.vendorName}</td></tr>` : ''}
        <tr style="border-top:1px solid #e5e7eb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">${cc ? 'Son Ödeme Tarihi' : 'Yenileme Tarihi'}</td><td style="padding:12px 16px;color:${urgency.color};font-size:14px;font-weight:700;">${dateStr}</td></tr>
        ${statementDay ? `<tr style="border-top:1px solid #e5e7eb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Hesap Kesim Günü</td><td style="padding:12px 16px;color:#111827;font-size:14px;">Her ayın ${statementDay}'ı</td></tr>` : ''}
        ${data.price ? `<tr style="border-top:1px solid #e5e7eb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">${cc ? 'Tutar' : 'Ücret'}</td><td style="padding:12px 16px;color:#111827;font-size:14px;">${data.price}</td></tr>` : ''}
      </table>
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${data.dashboardUrl}" style="display:inline-block;padding:13px 32px;background:#6366f1;color:#fff;text-decoration:none;border-radius:9px;font-weight:600;font-size:15px;">Panele Git</a>
      </div>
    </div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px;">
      Bu bildirimi RenewPilot tarafından aboneliğiniz kapsamında aldınız. <a href="${data.dashboardUrl}/settings" style="color:#6366f1;">Tercihleri değiştir</a>
    </div>
  </div>
</div>
</body></html>`;

  return { subject, text, html };
}

export function renderRenewalReminderSms(data: RenewalReminderData): string {
  const urgency = getUrgencyInfo(data.daysUntil);
  const typeLabel = ASSET_TYPE_LABEL[data.assetType] ?? data.assetType;
  const cc = isCreditCard(data.assetType);
  const title = cc ? formatCreditCardTitle(data) : data.assetName;
  if (data.daysUntil < 0) {
    return `[RenewPilot] ${urgency.emoji} ${title} (${typeLabel}) ${cc ? 'son ödeme' : 'yenileme'} ${Math.abs(data.daysUntil)} gün önce geçti. Panel: ${data.dashboardUrl}`;
  }
  if (data.daysUntil === 0) {
    return `[RenewPilot] ${urgency.emoji} ${title} (${typeLabel}) ${cc ? 'son ödeme tarihi BUGÜN' : 'BUGÜN sona eriyor'}! Panel: ${data.dashboardUrl}`;
  }
  return `[RenewPilot] ${urgency.emoji} ${title} (${typeLabel}) ${data.daysUntil} gün içinde ${cc ? 'ödenmeli' : 'yenilenmeli'}. Panel: ${data.dashboardUrl}`;
}
