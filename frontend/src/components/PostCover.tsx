import { coverGradient } from "@/lib/cover";
import { cn } from "@/lib/ui";

/** The post's image, or a deterministic gradient "cover" with the topic set in large type. */
export default function PostCover({ seed, image, label, className, large = false }: {
  seed: string;
  image?: string | null;
  label?: string | null;
  className?: string;
  large?: boolean;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- served by Django via the /media proxy
    return <img src={image} alt="" className={cn("h-full w-full object-cover", className)} />;
  }
  return (
    <div aria-hidden className={cn("relative h-full w-full overflow-hidden", className)} style={{ backgroundImage: coverGradient(seed) }}>
      <div className="cover-pattern absolute inset-0" />
      <div className="absolute -bottom-10 -right-10 size-48 rounded-full bg-white/15 blur-2xl" />
      {label && (
        <span className={cn("absolute bottom-4 left-5 font-serif font-semibold text-white/90 drop-shadow-sm", large ? "text-3xl" : "text-lg")}>
          {label}
        </span>
      )}
    </div>
  );
}
