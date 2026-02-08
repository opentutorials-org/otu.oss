import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/functions/utils/getAppUrl';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const appUrl = await getAppUrl();
    return [
        {
            url: appUrl,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 1,
        },
        {
            url: `${appUrl}/welcome`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
    ];
}
