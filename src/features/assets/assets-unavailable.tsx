import { Images, RotateCcw } from "lucide-react";

import { Button, EmptyState, ICON_STROKE } from "@/shared/peacock/ui";

/** Shown when the image library could not be loaded. */
export function AssetsUnavailable({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}): React.JSX.Element {
  return (
    <EmptyState
      icon={<Images />}
      headingLevel={2}
      title="Assets didn't load"
      body={message}
      action={
        <Button
          icon={<RotateCcw size={15} strokeWidth={ICON_STROKE} />}
          loading={retrying}
          loadingLabel="Retrying…"
          onClick={onRetry}
        >
          Try again
        </Button>
      }
    />
  );
}
