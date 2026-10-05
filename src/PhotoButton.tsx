import { useState } from 'react';
import { Expand } from 'lucide-react';
import PhotoViewer, { type PhotoAsset } from './PhotoViewer';
import type { Product } from './types';
export function productPhoto(p: Product): PhotoAsset | null {
  return p.image
    ? {
        id: p.id,
        name: p.name,
        image: p.image,
        source: p.imageSource || p.source,
        note: p.imageCaption,
      }
    : null;
}
export default function PhotoButton({
  asset,
  alternatives = [],
}: {
  asset: PhotoAsset;
  alternatives?: PhotoAsset[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="photo-study-open" onClick={() => setOpen(true)}>
        <Expand size={15} />
        放大与比较
      </button>
      {open && (
        <PhotoViewer
          paint={asset}
          name={asset.name}
          alternatives={alternatives}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
