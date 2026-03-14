import { Button } from "@/components/button";
import { resolveGHINUrl } from "@/lib/ghin";

interface GHINLinkButtonProps {
  ghinNumber?: string | null;
  ghinProfileUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GHINLinkButton({
  ghinNumber,
  ghinProfileUrl,
  size = "sm",
  className = "",
}: GHINLinkButtonProps) {
  const url = resolveGHINUrl({ ghinNumber, ghinProfileUrl });

  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noreferrer noopener">
      <Button type="button" variant="secondary" size={size} className={className}>
        GHIN
      </Button>
    </a>
  );
}
