import { ReactNode, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { Check, X } from "lucide-react";

interface SwipeableCardProps {
  children: ReactNode;
  onApprove?: () => void;
  onDefer?: () => void;
  disabled?: boolean;
}

export default function SwipeableCard({
  children,
  onApprove,
  onDefer,
  disabled = false,
}: SwipeableCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (disabled) return;
      setIsSwiping(true);
      // Limit swipe distance
      const offset = Math.max(-150, Math.min(150, eventData.deltaX));
      setSwipeOffset(offset);
    },
    onSwiped: (eventData) => {
      if (disabled) return;
      setIsSwiping(false);

      // Threshold for triggering action
      const threshold = 100;

      if (eventData.deltaX > threshold && onApprove) {
        // Swipe right - approve
        onApprove();
      } else if (eventData.deltaX < -threshold && onDefer) {
        // Swipe left - defer
        onDefer();
      }

      // Reset position
      setSwipeOffset(0);
    },
    trackMouse: false,
    trackTouch: true,
  });

  const showApproveHint = swipeOffset > 30;
  const showDeferHint = swipeOffset < -30;

  return (
    <div className="relative overflow-hidden">
      {/* Background hints */}
      <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
        <div
          className={`flex items-center gap-2 transition-opacity ${
            showApproveHint ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="h-6 w-6 text-white" />
          </div>
          <span className="text-sm font-medium text-green-600">Approve</span>
        </div>

        <div
          className={`flex items-center gap-2 transition-opacity ${
            showDeferHint ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="text-sm font-medium text-red-600">Defer</span>
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
            <X className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>

      {/* Swipeable content */}
      <div
        {...handlers}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? "none" : "transform 0.3s ease-out",
        }}
        className="relative z-10 bg-background"
      >
        {children}
      </div>
    </div>
  );
}
