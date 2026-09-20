"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Eye, Send, Wallet, type LucideIcon } from "lucide-react";

/**
 * Floating WhatsApp-style notification on the landing hero. Cycles through the
 * lifecycle of one quote: sent → viewed → signed → deposit paid.
 * Each item pops in at its own spot around the phone, holds, fades out, then the next one pops in.
 */
const ITEMS: { icon: LucideIcon; text: string; pos: string }[] = [
  { icon: Send, text: "הצעת מחיר #1042 נשלחה לדני כהן (767 ₪)", pos: "-end-14 top-[14%]" },
  { icon: Eye, text: "דני כהן פתח את הצעה #1042", pos: "-start-14 top-[36%]" },
  { icon: BadgeCheck, text: "דני כהן אישר וחתם על הצעה #1042 (767 ₪)", pos: "-end-10 top-[58%]" },
  { icon: Wallet, text: "דני כהן שילם מקדמה של 384 ₪ על הצעה #1042", pos: "-start-12 top-[78%]" },
];

// After the chat mockup has finished "typing" and sent the quote (see ChatMockup delays).
const INITIAL_DELAY = 5400;
const HOLD = 2600;
const EXIT = 350;

export function NotificationToast({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer = window.setTimeout(() => setVisible(true), INITIAL_DELAY);
    const cycle = window.setInterval(() => {
      setVisible(false);
      timer = window.setTimeout(() => {
        setIndex((i) => (i + 1) % ITEMS.length);
        setVisible(true);
      }, EXIT);
    }, INITIAL_DELAY + HOLD + EXIT);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(cycle);
    };
  }, []);

  const { icon: Icon, text, pos } = ITEMS[index];

  return (
    <div
      aria-live="polite"
      className={`w-[230px] rounded-2xl bg-white/90 backdrop-blur border border-line shadow-xl p-3 flex items-start gap-3 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95"
      } ${pos} ${className}`}
    >
      <span key={index} className="anim-pop grid place-items-center h-9 w-9 rounded-xl bg-[#25D366] text-white shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      <div className="text-[12px] leading-snug">
        <div className="font-semibold">WhatsApp · עכשיו</div>
        <div className="text-muted">{text}</div>
      </div>
    </div>
  );
}
