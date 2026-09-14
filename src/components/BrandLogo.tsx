/**
 * Mintten brand marks.
 *
 * The logo is a black wordmark — "Mintten" with a leaf standing in for the
 * dot of the "i", and a "PROFESSIONAL" strapline under it led by a small
 * rounded block. Both halves live here so the shell (sidebar, login, splash,
 * mobile header) can never drift apart the way the old name did, and so the
 * leaf is drawn once instead of being pasted as a raster image that would
 * blur on a retina screen and could not follow the current text colour.
 *
 * Everything inherits `currentColor`, so the same components sit correctly on
 * the light sidebar, on the dark brand gradient, and on a printed page.
 */

type LeafProps = {
  className?: string;
  style?: React.CSSProperties;
};

/**
 * The leaf from the logo: a pointed almond tilted to the right, with the
 * midrib cut out of it (fillRule "evenodd") exactly like the printed mark —
 * a solid blob reads as a generic drop instead of a leaf at 16px.
 */
export function MinttenLeaf({ className, style }: LeafProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="rotate(38 12 12)">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M12 1.6c4.9 5 5.7 11.8 2.1 17.4a11.6 11.6 0 0 1-2.1 2.7 15.6 15.6 0 0 1-2.1-2.7C6.3 13.4 7.1 6.6 12 1.6ZM12 5l.3 1.2v12.8l-.3 1.6-.3-1.6V6.2Z"
        />
      </g>
    </svg>
  );
}

const SIZES = { sm: 15, md: 18, lg: 22 } as const;

type WordmarkProps = {
  /** Wordmark cap size. Pass a number for a one-off size in px. */
  size?: keyof typeof SIZES | number;
  /** Show the "PROFESSIONAL" strapline under the wordmark. */
  tagline?: boolean;
  className?: string;
};

/**
 * "Mintten" set in the shell's own bold sans with the leaf replacing the
 * dot of the "i".
 *
 * The "i" is written as U+0131 (dotless i) — with a normal "i" the font's own
 * dot would still be painted underneath the leaf, showing as a smudge at
 * small sizes. The leaf is then positioned in `em`, so it tracks the font
 * size wherever this is used instead of needing a hand-tuned offset per
 * call site.
 */
export function MinttenWordmark({ size = "sm", tagline = false, className }: WordmarkProps) {
  const px = typeof size === "number" ? size : SIZES[size];
  // The strapline never goes below 8px, or the wide tracking turns it into
  // noise; the leading block is then sized off IT, not off the wordmark, so
  // the block always matches the height of the letters beside it.
  const tag = Math.max(8, Math.round(px * 0.42));

  return (
    // role + aria-label, because the word is spelled with a DOTLESS i (see
    // below): read out literally, a screen reader would announce something
    // that is not the company's name.
    <span
      className={className}
      role="img"
      aria-label={tagline ? "Mintten Professional" : "Mintten"}
      style={{ display: "inline-flex", flexDirection: "column" }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: px,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          // 1.6, not the tighter 1.1 this shell uses elsewhere: the leaf
          // stands well clear above the "i", and that half-leading is what
          // keeps it INSIDE the line box. Several call sites (the sidebar
          // brand block) sit in an overflow-hidden container, which would
          // otherwise shave the tip off the leaf.
          lineHeight: 1.6,
          whiteSpace: "nowrap",
        }}
      >
        M
        <span style={{ position: "relative", display: "inline-block", lineHeight: 1 }}>
          {"\u0131"}
          <MinttenLeaf
            style={{
              position: "absolute",
              left: "50%",
              top: "-0.3em",
              width: "0.42em",
              height: "0.42em",
              transform: "translateX(-46%)",
            }}
          />
        </span>
        ntten
      </span>
      {tagline && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: tag * 0.45,
            fontSize: tag,
            fontWeight: 600,
            letterSpacing: "0.26em",
            lineHeight: 1.4,
            opacity: 0.68,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: tag,
              height: tag * 0.62,
              borderRadius: tag * 0.18,
              background: "currentColor",
            }}
          />
          PROFESSIONAL
        </span>
      )}
    </span>
  );
}
