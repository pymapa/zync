# Global PRP

## Stack
- **Frontend:** React + TypeScript + Vite
- **UI:** Tailwind CSS + Shadcn/ui components
- **State:** Zustand for local/global state, only when absolutely necessary
- **Data:** React Query for API calls + caching
- **Testing:** Vitest + Testing Library
- **Lint/Format:** ESLint (standard-with-typescript) + Prettier

## AI instructions
- Always use existing tools — do NOT reimplement buttons, modals, or state management logic.
- Use Shadcn UI components for all UI primitives (`Button`, `Card`, `Dialog`, `Input`, etc.).
- Use Tailwind utility classes for layout and spacing.
- Use Zustand for client-side state.
- Use React Query for async data fetching, caching, and mutation.
- Follow patterns in `runbooks/conventions.md` and `runbooks/patterns.md`.

## Frontend architecture
- Use domain-driven architecture

## Folder structure
- `src/components` → base UI pieces (usually Shadcn)
- `src/features` → feature-specific UI + state
- `src/lib` → utilities, types, config
