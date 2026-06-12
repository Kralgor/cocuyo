import { Linking, Share } from 'react-native';

import type { RegionEntry } from './api';
import { formatDuration, type Lang } from './i18n';

const SHARE_URL = 'https://app.cocuyo.kralgor.com';

const STATUS_LABELS: Record<string, Record<Lang, string>> = {
  no_power: { es: 'Sin luz', en: 'No power' },
  power_back: { es: 'Con luz', en: 'Power on' },
  unstable: { es: 'Inestable', en: 'Unstable' },
  normal: { es: 'Normal', en: 'Normal' },
};

function getStatusLabel(status: string, lang: Lang): string {
  return STATUS_LABELS[status]?.[lang] ?? status;
}

export function composeShareText(region: RegionEntry, _regionKey: string, lang: Lang = 'es'): string {
  const lines = [`*${region.display_name}* — ${getStatusLabel(region.status, lang)}`];

  if (region.outage?.started_at && typeof region.outage.elapsed_minutes === 'number') {
    const prefix = lang === 'en' ? 'No power for' : 'Sin luz hace';
    lines.push(`${prefix} ${formatDuration(region.outage.elapsed_minutes, lang)}`);
  }

  if (region.outage?.estimated_restoration) {
    const prefix = lang === 'en' ? 'Estimated return' : 'Estimado de regreso';
    lines.push(`${prefix}: ${region.outage.estimated_restoration}`);
  }

  lines.push('', `${lang === 'en' ? 'Source' : 'Fuente'}: Cocuyo — ${SHARE_URL}`);

  return lines.join('\n');
}

export async function shareToWhatsApp(text: string): Promise<void> {
  const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;

  if (await Linking.canOpenURL(whatsappUrl)) {
    await Linking.openURL(whatsappUrl);
    return;
  }

  await Share.share({ message: text });
}
