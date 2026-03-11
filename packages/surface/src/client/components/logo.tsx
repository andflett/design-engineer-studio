import React from "react";
import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M9 21H7v-2h2zm4 0h-2v-2h2zm4 0h-2v-2h2zm4 0h-2v-2h2zM5 17H3v-2h2zm4 0H7v-2h2zm12 0h-2v-2h2zM5 13H3v-2h2zm4 0H7v-2h2zm12 0h-2v-2h2zM5 9H3V7h2zm4 0H7V7h2zm4 0h-2V7h2zm4 0h-2V7h2zm4 0h-2V7h2zM5 5H3V3h2zm4 0H7V3h2zm4 0h-2V3h2zm4 0h-2V3h2z"
      ></path>
    </svg>
  );
}
