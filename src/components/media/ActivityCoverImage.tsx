"use client";

import { useState, type CSSProperties } from 'react';
import { coverCategory, coverSources, coverThemes, type CoverContext, type CoverCategory } from '@/utils/coverPolicy';

type Props = CoverContext & {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  style?: CSSProperties;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
};

export default function ActivityCoverImage({src, fallbackSrc, cardType, categoryName, activityName, ...props}: Props) {
  const category = coverCategory({cardType, categoryName, activityName});
  const sources = coverSources(src, fallbackSrc, category);
  return <CoverAttempt key={JSON.stringify([sources,category])} {...props} sources={sources} category={category}/>;
}

function CoverAttempt({sources, category, alt, className = 'h-full w-full object-cover', style, loading, decoding}: Pick<Props,'alt'|'className'|'style'|'loading'|'decoding'> & {sources: string[]; category: CoverCategory}) {
  const [attempt, setAttempt] = useState(0);
  const theme = coverThemes[category];
  if (attempt >= sources.length) {
    // Inline geometry is the final presentation: no network or image decoding remains.
    return <svg viewBox="0 0 640 480" preserveAspectRatio="xMidYMid slice" role={alt?'img':undefined} aria-label={alt || undefined} aria-hidden={!alt} className={className} style={style} data-cover-fallback={category}>
      <rect width="640" height="480" fill={theme.color}/>
      <path d={theme.path} transform="translate(224 114) scale(8)" fill="none" stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>;
  }
  // Keep the original URL/crop behavior; Next Image's remote optimizer is not used here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={sources[attempt]} src={sources[attempt]} alt={alt} className={className} style={style} loading={loading} decoding={decoding}
    onError={() => setAttempt(current => current === attempt ? current + 1 : current)}/>;
}
