"use client";

import {
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type ClickableActivityCardProps = {
  href: string;
  ariaLabel: string;
  className: string;
  children: ReactNode;
};

function isInteractiveTarget(
  target: EventTarget | null
) {
  if (
    !(target instanceof Element)
  ) {
    return false;
  }

  return Boolean(
    target.closest(
      "a, button, input, textarea, select, option, label, [role='button']"
    )
  );
}

export default function ClickableActivityCard({
  href,
  ariaLabel,
  className,
  children,
}: ClickableActivityCardProps) {
  const router = useRouter();

  function openCard(
    event:
      | MouseEvent<HTMLElement>
      | KeyboardEvent<HTMLElement>
  ) {
    if (
      isInteractiveTarget(
        event.target
      )
    ) {
      return;
    }

    router.push(href);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLElement>
  ) {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    event.preventDefault();
    openCard(event);
  }

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={openCard}
      onKeyDown={handleKeyDown}
      className={`${className} group cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2`}
    >
      {children}
    </article>
  );
}
