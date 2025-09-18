import { NextConfig } from 'next';

const config = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  images: {
    domains: ['i.ytimg.com']
  }
};

export default config satisfies NextConfig;
