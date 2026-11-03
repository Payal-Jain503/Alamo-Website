export function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {'★★★★★'.slice(0, Math.round(rating))}
      <span className="stars-off">{'★★★★★'.slice(Math.round(rating))}</span>
    </span>
  );
}
