import { useCallback, useEffect, useState } from 'react';
import { img } from '../lib/format';
import { IconArrow, IconArrowLeft, IconX } from './Icons';

export default function Gallery({ images, alt = 'Performance Studio', className = 'gallery-grid' }) {
  const [idx, setIdx] = useState(null);
  const close = useCallback(() => setIdx(null), []);
  const step = useCallback((d) => setIdx((i) => (i + d + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (idx === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [idx, close, step]);

  return (
    <>
      <div className={className}>
        {images.map((name, i) => (
          <button key={name} className="gallery-item" onClick={() => setIdx(i)} aria-label={`Kép nagyítása (${i + 1}/${images.length})`}>
            <img src={img(name, true)} alt={alt} loading="lazy" />
          </button>
        ))}
      </div>
      {idx !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={close}>
          <img src={img(images[idx])} alt={alt} onClick={(e) => e.stopPropagation()} />
          <button className="lb-btn lb-close" onClick={close} aria-label="Bezárás"><IconX /></button>
          <button className="lb-btn lb-prev" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Előző"><IconArrowLeft /></button>
          <button className="lb-btn lb-next" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Következő"><IconArrow /></button>
          <span className="lb-count">{idx + 1} / {images.length}</span>
        </div>
      )}
    </>
  );
}
