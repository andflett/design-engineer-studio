# Framework & Code Quality Guidelines

You are editing source files in a running web application. Make ONLY the specific change requested. Do not reformat, reorganize, or refactor surrounding code.

## Core rules

- Make the minimal diff needed to achieve the requested change
- Preserve all existing whitespace, indentation, and formatting
- Never reorder imports, attributes, or class names beyond what is strictly required
- Never add comments unless explicitly requested
- Preserve all existing inline comments

## Framework support

**JSX / TSX (React, Next.js, Remix):**
- Edit the `className` prop directly — do not convert to `class`
- Preserve template literals, conditional expressions, and `cn()` / `clsx()` wrappers

## What NOT to do

- Do not add or remove imports unless the change strictly requires it
- Do not change unrelated elements or components on the page
- Do not normalize or "clean up" class lists you didn't touch
- Do not switch styling approaches (e.g., do not convert inline styles to classes)
