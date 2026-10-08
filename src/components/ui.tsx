"use client";
/* eslint-disable @next/next/no-img-element -- private avatars require cookie-forwarding that the image optimizer does not provide */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  X,
  ArrowRight,
  Timer,
  Zap,
  Flame,
  Flower2,
  Footprints,
  MoonStar,
  RefreshCcw,
  Shield,
} from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : "brand-stacked"}`}>
      <span>MovX</span>
      <span className="brand-club">Club</span>
    </span>
  );
}
export function Avatar({
  initials,
  color = "lime",
  small = false,
  imageUrl = null,
  alt = "",
}: {
  initials: string;
  color?: string;
  small?: boolean;
  imageUrl?: string | null;
  alt?: string;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const visibleImageUrl = imageUrl === failedImageUrl ? null : imageUrl;
  return (
    <span
      className={`avatar ${color} ${small ? "small" : ""}`}
      aria-hidden={!alt ? true : undefined}
      role={!visibleImageUrl && alt ? "img" : undefined}
      aria-label={!visibleImageUrl && alt ? alt : undefined}
    >
      {visibleImageUrl ? (
        <img
          src={visibleImageUrl}
          alt={alt}
          width={small ? 32 : 90}
          height={small ? 32 : 90}
          onError={() => setFailedImageUrl(visibleImageUrl)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
export function AvatarStack() {
  return (
    <div
      className="avatar-stack"
      aria-label="A welcoming group of club members"
    >
      <Avatar initials="DP" color="peach" small />
      <Avatar initials="LW" color="lavender" small />
      <Avatar initials="MM" color="blue" small />
      <span className="avatar small more">+2</span>
    </div>
  );
}
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
export function SectionTitle({
  title,
  href,
  action = "View all",
}: {
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {href && (
        <Link className="text-link" href={href}>
          {action}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Artwork({
  kind,
  className = "",
  title = "",
  large = false,
}: {
  kind: string;
  className?: string;
  title?: string;
  large?: boolean;
}) {
  if (kind === "run")
    return (
      <div className={`artwork photo ${className}`}>
        <Image
          src="/images/run-club.webp"
          alt="Friends running together on an urban track"
          fill
          sizes={
            large
              ? "(max-width: 800px) 100vw, 800px"
              : "(max-width: 700px) 100vw, 450px"
          }
          priority={large}
        />
        <span className="photo-shade" />
      </div>
    );
  const Icon =
    kind === "strength"
      ? Flame
      : kind === "fight"
        ? Zap
        : kind === "ground"
          ? Shield
          : kind === "recovery"
            ? RefreshCcw
            : kind === "night"
              ? MoonStar
              : Flower2;
  const word =
    kind === "strength"
      ? "SHOW UP."
      : kind === "fight"
        ? "FIND YOUR FIRE."
        : kind === "ground"
          ? "FIND YOUR BASE."
          : kind === "recovery"
            ? "RESET WELL."
            : kind === "night"
              ? "MOVE AFTER DARK."
              : "MAKE SPACE.";
  return (
    <div className={`artwork graphic ${kind} ${className}`} aria-hidden="true">
      <span className="graphic-rings" />
      <Icon className="graphic-icon" strokeWidth={1} />
      <span className="graphic-word">{title || word}</span>
      <span className="graphic-meta">MOVX CLUB / MOVEMENT FOR EVERYONE</span>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = ref.current!.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-top">
        <span className="eyebrow">MOVX CLUB / PREVIEW</span>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="empty">
      <Footprints size={30} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link href={href} className="button secondary">
          {action}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function DateLine({ date }: { date: string }) {
  return (
    <span className="meta-line">
      <Timer size={14} />
      {date}
    </span>
  );
}
