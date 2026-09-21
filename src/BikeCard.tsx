import { ArrowUpRight } from 'lucide-react';
import type { Bike } from './types';
import { imageUrl } from './catalog';
import { CompareButton, SaveButton } from './Library';
import { base } from './SiteChrome';
import { yearLabel } from './catalogBrowse';

export default function BikeCard({ bike }: { bike: Bike }) {
  return (
    <article className="bike-card collectible-card">
      <a
        className="bike-card-main"
        href={`${base}?bike=${bike.id}`}
        aria-label={`探索 ${bike.name}`}
      >
        <div className="card-top">
          <span>{bike.brandId.toUpperCase()}</span>
          <span>{bike.kind}</span>
        </div>
        <div className={`card-image ${bike.imageTone === 'dark' ? 'card-photo-dark' : ''}`}>
          <img
            src={imageUrl(bike.image)}
            style={{
              objectPosition: bike.imagePosition,
              transform: bike.imageFit === 'cover' ? 'scale(1.35)' : undefined,
            }}
            alt={bike.name}
            loading="lazy"
          />
        </div>
        <div className="card-bottom">
          <div>
            <h3>{bike.family}</h3>
            <p>{bike.build}</p>
          </div>
          <span className="card-arrow">
            <ArrowUpRight size={18} />
          </span>
        </div>
        <div className="card-footer">
          <b className="model-year" title={bike.yearNote}>
            {yearLabel(bike)}
          </b>
          <span>{bike.edition}</span>
        </div>
      </a>
      <div className="card-actions">
        <SaveButton bike={bike} />
        <CompareButton bike={bike} />
      </div>
    </article>
  );
}
