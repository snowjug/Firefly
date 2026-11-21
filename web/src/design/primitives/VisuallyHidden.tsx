import type { ReactNode } from 'react';

type HiddenTag = 'span' | 'div' | 'p' | 'h2' | 'h3' | 'label';

/** Text for assistive technology that sighted users do not need to see. */
export function VisuallyHidden({
  as: Tag = 'span',
  children,
  id,
}: {
  as?: HiddenTag;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Tag className="visually-hidden" id={id}>
      {children}
    </Tag>
  );
}
