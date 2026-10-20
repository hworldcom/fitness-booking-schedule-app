import { getImageProps, type StaticImageData } from "next/image";
import type { ReactNode } from "react";

export function MarketplaceHero({
  image,
  alt,
  titleId,
  children,
  description,
  imageFrameClassName,
  sizes = "100vw",
  className = "",
}: {
  image: StaticImageData;
  alt: string;
  titleId: string;
  children: ReactNode;
  description?: string;
  imageFrameClassName?: string;
  sizes?: string;
  className?: string;
}) {
  const { props } = getImageProps({
    src: image,
    alt,
    fill: true,
    sizes,
    quality: 85,
    loading: "eager",
    fetchPriority: "high",
    className: "marketplace-home-hero-image",
  });
  // eslint-disable-next-line @next/next/no-img-element -- getImageProps supplies optimized responsive sources
  const heroImage = <img {...props} alt={props.alt} />;

  return (
    <section
      className={`marketplace-home-hero ${className}`.trim()}
      aria-labelledby={titleId}
    >
      {imageFrameClassName ? (
        <div className={imageFrameClassName}>{heroImage}</div>
      ) : (
        heroImage
      )}
      <div className="marketplace-home-hero-copy">
        <div>
          <h1 id={titleId}>{children}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>
    </section>
  );
}
