import type { AvatarProps } from '../../../types/platform-ui.types.ts';
import { initials } from '../lib/format.ts';

/** Avatar circular com as iniciais do nome (.av). */
export function Avatar({ nome, size }: Readonly<AvatarProps>) {
  return (
    <span className={size ? `av ${size}` : 'av'} aria-hidden="true">
      {initials(nome)}
    </span>
  );
}
