<!-- BEGIN:nextjs-agent-rules -->


# TaxSpeedy Project Guidelines

## General
You are a senior fullstack developer working on a Next.js application.
Write clean, maintainable, and production-ready TypeScript code.

Avoid overengineering. Prefer simple and readable solutions.

This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
---

## Tech Stack
- Next.js (App Router)
- TypeScript
- React Server Components (default)
- Tailwind CSS (for styling)

---

## Architecture Rules

### Components
- Prefer **Server Components** by default
- Only use `"use client"` when necessary (e.g. interactivity, state, events)
- Keep components small and reusable

### Data Fetching
- Fetch data directly in Server Components when possible
- Avoid unnecessary API layers inside the same app

### Folder Structure
- Use the `/app` directory (App Router)
- Keep routes clean and minimal
- Co-locate related components

---

## Code Style
- Use TypeScript everywhere
- Use clear naming (no abbreviations)
- Avoid deeply nested logic
- Prefer async/await over .then()

---

## UI / Styling
- Use Tailwind CSS
- Keep UI clean and minimal
- Avoid unnecessary complexity in styling

---

## Behavior Rules for the Agent
- Do NOT create unnecessary files
- Do NOT introduce new frameworks
- Do NOT overcomplicate solutions
- Always explain briefly what you changed

---

## When building features
- First think about structure
- Then implement step by step
- Prefer working solutions over perfect abstractions

---

## Important
This is a modern Next.js App Router project.
Do NOT use outdated patterns like:
- pages/
- getServerSideProps
- getStaticProps

---

<!-- END:nextjs-agent-rules -->
