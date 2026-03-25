import { useState } from 'react';
import { useActivityPhotos } from '../../hooks/useActivityPhotos';
import { Spinner } from '../ui';
import type { DetailedActivity } from '../../types';

interface Props {
  readonly activity: DetailedActivity;
}

export function ActivityPhotos({ activity }: Props) {
  const { photos, isLoading } = useActivityPhotos(String(activity.id), true);
  const [enlargedId, setEnlargedId] = useState<string | null>(null);

  // Fallback to primary photo from activity summary while loading
  const primaryUrl = activity.photos?.primary?.url600;
  const photoCount = activity.photos?.count ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" className="text-accent" />
      </div>
    );
  }

  // Use fetched photos if available, otherwise fall back to primary
  const displayPhotos = photos.length > 0
    ? photos
    : primaryUrl
      ? [{ uniqueId: 'primary', url: primaryUrl, caption: '', location: null }]
      : [];

  if (displayPhotos.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Enlarged view */}
      {enlargedId && (
        <div className="relative">
          <img
            src={displayPhotos.find(p => p.uniqueId === enlargedId)?.url}
            alt={displayPhotos.find(p => p.uniqueId === enlargedId)?.caption || activity.name}
            className="w-full max-h-[600px] object-contain rounded-xl bg-surface border border-border/50"
          />
          <button
            onClick={() => setEnlargedId(null)}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm border border-border/50 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {displayPhotos.map((photo) => (
          <button
            key={photo.uniqueId}
            onClick={() => setEnlargedId(enlargedId === photo.uniqueId ? null : photo.uniqueId)}
            className={`relative aspect-square overflow-hidden rounded-xl border transition-all cursor-pointer ${
              enlargedId === photo.uniqueId
                ? 'border-accent ring-2 ring-accent/30'
                : 'border-border/50 hover:border-border hover:shadow-md hover:scale-[1.02]'
            }`}
          >
            <img
              src={photo.url}
              alt={photo.caption || activity.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {photo.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-white text-[10px] truncate">{photo.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Count info */}
      {photoCount > 0 && photos.length === 0 && (
        <p className="text-xs text-text-muted">
          {photoCount} photo{photoCount > 1 ? 's' : ''} on this activity
        </p>
      )}
    </div>
  );
}
