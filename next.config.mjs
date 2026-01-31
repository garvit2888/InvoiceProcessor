/** @type {import('next').NextConfig} */
const nextConfig = {
    // Increase body size limit for PDF uploads
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
};

export default nextConfig;
