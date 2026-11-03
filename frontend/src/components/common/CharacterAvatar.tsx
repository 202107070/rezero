import type { CSSProperties } from 'react';
import {
  getCharacterFallbackIcon,
  getCharacterImageSrc,
  getCharacterLabel,
} from '../../utils/characterUtils';

interface CharacterAvatarProps {
  character?: string | null;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}

/** 캐릭터 id/레거시 이모지를 이미지(또는 폴백 아이콘)로 표시 */
export function CharacterAvatar({ character, className, style, alt }: CharacterAvatarProps) {
  const src = getCharacterImageSrc(character);
  const label = alt || getCharacterLabel(character);

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={`character-avatar-img${className ? ` ${className}` : ''}`}
        style={{
          objectFit: 'contain',
          objectPosition: 'center',
          background: 'transparent',
          // 전역 pixelated 오버라이드 — 애니 일러스트는 부드럽게 축소
          imageRendering: 'auto',
          ...style,
        }}
        draggable={false}
      />
    );
  }

  return (
    <span className={className} style={style} aria-label={label}>
      {getCharacterFallbackIcon(character)}
    </span>
  );
}
