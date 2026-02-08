import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/functions/utils/getAppUrl';

export default async function robots(): Promise<MetadataRoute.Robots> {
    const appUrl = await getAppUrl();
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/private/',
        },
        sitemap: `${appUrl}/sitemap.xml`,
    };
}
