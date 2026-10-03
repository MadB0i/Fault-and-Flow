import { ArrowUpRight, MapPin } from 'lucide-react';
import catalogue from '../data/earthquakes.json';
import { nearestRecords } from '../shared/exploration.js';
import { magnitudeBand } from '../shared/seismic-display.js';
import type { AtlasCopy } from '../shared/i18n/atlas.js';
import { FLOOD_HISTORY } from '../shared/flood-history.js';

type Event = (typeof catalogue.events)[number];
const icon = { size: 18, strokeWidth: 1.5, 'aria-hidden': true as const };

export function EventRecord({
  event,
  copy,
  focus,
}: {
  event: Event;
  copy: AtlasCopy;
  focus: () => void;
}) {
  return (
    <article className="event-detail">
      <p className="eyebrow">{copy.historical} · UTC</p>
      <strong className="event-magnitude" data-band={magnitudeBand(event.magnitude)}>
        M {event.magnitude} <small>{event.magnitudeType}</small>
      </strong>
      <p>
        <time dateTime={event.time}>
          {event.time.replace('T', ' ').replace('Z', ' UTC')}
        </time>
      </p>
      <dl className="event-facts">
        <div>
          <dt>{copy.depthKm}</dt>
          <dd>{event.depthKm ?? '—'} km</dd>
        </div>
        <div>
          <dt>{copy.coordinates}</dt>
          <dd>
            {event.latitude.toFixed(3)}°, {event.longitude.toFixed(3)}°
          </dd>
        </div>
      </dl>
      <p>
        {copy.magnitudeHint}. {copy.noPrediction}
      </p>
      <button className="primary-button" type="button" onClick={focus}>
        <MapPin {...icon} />
        {copy.focusEvent}
      </button>
      <a href={event.url} target="_blank" rel="noreferrer">
        {copy.eventSource}
        <ArrowUpRight {...icon} />
      </a>
    </article>
  );
}

export function DistrictStory({
  anchor,
  name,
  copy,
  select,
}: {
  anchor: { latitude: number; longitude: number };
  name: string;
  copy: AtlasCopy;
  select: (event: Event) => void;
}) {
  const nearby = nearestRecords(anchor, catalogue.events);
  return (
    <article className="district-story">
      <p className="eyebrow">
        {copy.overview} · {copy.districtStory}
      </p>
      <h3>{name}</h3>
      <p>{copy.districtNote}</p>
      <h3>{copy.nearbyRecords}</h3>
      <p>{copy.nearbyNote}</p>
      <div className="nearby-records">
        {nearby.map(({ record, distance }) => (
          <button key={record.id} type="button" onClick={() => select(record)}>
            <span
              className="record-dot"
              data-band={magnitudeBand(record.magnitude)}
              aria-hidden="true"
            />
            <span>
              <strong>
                M {record.magnitude} · {record.time.slice(0, 10)}
              </strong>
              <small>
                {distance.toFixed(0)} km · {copy.anchorDistance}
              </small>
            </span>
            <ArrowUpRight {...icon} />
          </button>
        ))}
      </div>
      <h3>{copy.floodHistory}</h3>
      <p>{copy.historyNote}</p>
      <div className="official-links">
        {FLOOD_HISTORY.map((item) => (
          <a key={item.year} href={item.url} target="_blank" rel="noreferrer">
            {item.year} · {copy[item.title]}
            <ArrowUpRight {...icon} />
          </a>
        ))}
      </div>
    </article>
  );
}
