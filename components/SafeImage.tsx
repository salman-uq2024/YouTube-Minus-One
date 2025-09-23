import Image, { type ImageProps } from 'next/image';
import classNames from 'classnames';

type SafeImageProps = Omit<ImageProps, 'src'> & { src: string };

const allowedHosts = new Set(['i.ytimg.com', 'i9.ytimg.com', 'yt3.ggpht.com', 'yt3.googleusercontent.com']);

function isAllowedHost(src: string): boolean {
  if (!src) return false;
  try {
    const url = new URL(src);
    return allowedHosts.has(url.hostname);
  } catch {
    // relative paths are allowed
    return true;
  }
}

export function SafeImage({ src, className, style, loading, alt, ...rest }: SafeImageProps) {
  const effectiveLoading = loading ?? 'lazy';
  const isAllowed = isAllowedHost(src);

  if (isAllowed) {
    return <Image src={src} alt={alt} className={className} style={style} loading={effectiveLoading} {...rest} />;
  }

  const { width, height } = rest as { width?: number; height?: number };

  if ('fill' in rest && rest.fill) {
    return (
      <div className={classNames('relative', className)} style={{ ...style, position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading={effectiveLoading} className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      loading={effectiveLoading}
      width={width ?? 1}
      height={height ?? 1}
      className={className}
      style={style}
    />
  );
}
