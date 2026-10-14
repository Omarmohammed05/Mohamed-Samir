import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['googleapis', 'exceljs'],
  transpilePackages: ['next-intl'],
  ...(process.env.BASE44_PREVIEW_MODE === '1' && process.env.BASE44_PUBLIC_HOST_SUFFIX
    ? { allowedDevOrigins: ['3000-' + process.env.BASE44_PUBLIC_HOST_SUFFIX] }
    : {}),
};

export default withNextIntl(nextConfig);
