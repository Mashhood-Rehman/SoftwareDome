import { Star } from "@/lib/fa-icons";

export default function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          className={i < rounded ? "text-amber-400 fill-amber-400" : "text-zinc-200 fill-zinc-200"}
        />
      ))}
    </div>
  );
}
