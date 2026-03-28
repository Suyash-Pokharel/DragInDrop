# DragInDrop Development Guidelines & AI Instructions

This document serves as the absolute source of truth for the DragInDrop project architecture, rules, and best practices. **Any AI assistant working on this project must read and adhere to these rules before writing any code or proposing solutions.**

## 1. Core Tech Stack
- **Framework:** Next.js (App Router paradigm)
- **Language:** TypeScript (Strictly enforced)
- **Styling:** Tailwind CSS (v4)
- **Database / ORM:** Prisma with PostgreSQL
- **Caching / Rate Limiting:** Redis (via `ioredis` and `rate-limiter-flexible`)
- **Icons:** Lucide React

## 2. Strict Rules for Development (AI & Human)

### 2.1 Language Constraints & Typing
- **TypeScript Only:** All development must be done in TypeScript (`.ts`, `.tsx`). Never use `.js`/`.jsx` files.
- **Strict Typing:** Never use `any` or `@ts-ignore`. Define strict interfaces and types for all props, API parameters, database queries, and responses. 
- **Prisma Alignment:** Keep TypeScript types precisely synchronized with the Prisma schema. If the schema dictates a field is non-nullable (e.g., `String`), the corresponding TS type must be `string`, not `string | null`.

### 2.2 Implementation Protocol (The "Two-Check" Rule)
**Before writing or modifying any code:**
1. **Context Verification:** Read the relevant target files entirely. Understand their current state, logic flow, and imports.
2. **Dependency Check:** Trace how the target file interacts with the rest of the application (e.g., `layout.tsx`, `middleware.ts`, `globals.css`, global contexts like `ModalProvider`, and the database schema).

**After implementing changes:**
1. **Self-Review:** Double-check the modified code line-by-line. Ensure it precisely follows the intended logic, lacks syntax errors, and adheres strictly to industry standards.
2. **Integration Verification:** Ensure the changes don't break existing components. Always verify by running a build (`pnpm build`) to catch hidden TypeScript mismatches, broken imports, or server/client component boundary errors.

## 3. Architecture & Next.js App Router Best Practices

### 3.1 Server vs Client Components
- Default to **Server Components** (`.tsx` without `"use client"`). They offer better performance, SEO, and security.
- Only use **Client Components** (`"use client"`) at the leaves of the component tree when interactivity (hooks like `useState`, `useEffect`) or browser APIs (`window`, `document`) are strictly required.
- **Never** import Server-only code (like database clients or secret keys) into Client Components.

### 3.2 Data Fetching & Mutations
- Prefer **React Server Components** for directly fetching data.
- Prefer **Server Actions** (`"use server"`) for form submissions and simple data mutations over traditional API routes (`/api/...`) where applicable, as they integrate seamlessly with Next.js caching and revalidation.

### 3.3 State Management
- For simple global UI state (like modals or drawers), use React Context strictly applied where needed (e.g., `ModalProvider.tsx`).
- For server state, rely on Next.js Server Components and fetch caching. 

### 3.4 Custom Authentication & Authorization
- **Custom Auth Flow:** The project uses a custom token-based session authentication flow (HMAC-signed session cookies). **Do not attempt to integrate NextAuth/Auth.js unless explicitly requested.**
- **Middleware:** `middleware.ts` runs on the Edge runtime and securely protects routes like `/dashboard` and `/admin` by verifying the HMAC signature of the session cookie.
- **Admin Access:** Use `ensureAdmin.ts` for strictly securing admin-only server actions or API routes.

## 4. UI / UX & Styling Standards

### 4.1 Tailwind CSS Integration
- Use generic, tokenized Tailwind utility classes. 
- Avoid arbitrary values (e.g., `w-[153px]`, `text-[17px]`) unless absolutely necessary. Rely on predefined sizing/spacing tokens.
- **Theme Support:** Ensure components uniformly support both Light and Dark modes. Utilize the project's global CSS variables (e.g., `bg-surface`, `text-text-main`, `text-primary`) and `dark:` variants for seamless theme switching.

### 4.2 Component Reusability
- Build atomic, reusable UI components. If you find yourself duplicating UI logic, extract it into a dedicated component.
- Ensure components are highly responsive. Adopt a **Mobile-first approach** using Tailwind prefixes (`sm:`, `md:`, `lg:`, `xl:`).

## 5. Security & Performance

### 5.1 Environment Variables
- Never expose sensitive keys to the browser. Only prefix with `NEXT_PUBLIC_` if the client explicitly needs the variable.
- Always validate the existence of critical environment variables (like `SESSION_SECRET` or `REDIS_URL`) before attempting to use them.

### 5.2 Rate Limiting (Redis)
- The project implements resilient rate limiting using Redis as the primary store, with an in-memory fallback (`src/lib/limiter.ts`).
- Always protect critical mutation paths (e.g., Login, Registration, Password Reset, File Uploads) to prevent abuse and DDoS.

### 5.3 Database Instantiation
- Use the singleton pattern defined in `src/lib/prisma.ts` to retrieve the database client. Do **not** instantiate `new PrismaClient()` directly in endpoints, as it will exhaust database connections during Next.js Hot Module Replacement (HMR) in development.

## 6. Code Cleanliness & Maintenance
- **Absolute Imports:** Use the `@/` alias configured in `tsconfig.json` for all internal project imports (e.g., `import { getPrisma } from "@/lib/prisma";`) instead of complex relative paths (`../../../lib/prisma`).
- **Dead Code:** Regularly prune unused imports, variables, props, and commented-out code blocks. Do not leave "dead" fallback code unless heavily documented with `// TODO: [Explanation]`.
- **Meaningful Comments:** Comment the *why* (the business logic or core reasoning), not the *what* (the descriptive code syntax). Use standard JSDoc `/** ... */` for complex utilities or services.

---

*Note to AI: Whenever you are invoked for a new task in this workspace, assume these guidelines are active. Prioritize type safety, performance, and the "Two-Check" Rule above all else.*
