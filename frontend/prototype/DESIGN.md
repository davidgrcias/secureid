# Design System Strategy: The Digital Architect

## 1. Overview & Creative North Star
In the world of digital identity and electronic signatures, "trust" is often mistranslated into rigid, clinical layouts that feel more like a hospital than a high-end service. This design system breaks that mold. 

**Creative North Star: "The Digital Architect"**
This system treats digital identity as an architectural masterpiece. We move beyond the "SaaS Template" look by utilizing **intentional asymmetry**, **tonal layering**, and **editorial typography scales**. The layout is designed to feel anchored and secure, yet fluid and premium. We emphasize breathing room (white space) not as "empty space," but as a luxury element that guides the user’s focus toward the most critical actions: verifying and signing.

---

### 2. Colors: The Tonal Spectrum
We utilize a Material-inspired palette that moves away from flat color blocks toward a sophisticated hierarchy of depth.

*   **Primary (`#003d9b`) & Primary Container (`#0052cc`):** Our "Command Blue." Use the Primary Container for high-action states to provide a vibrant, modern pulse.
*   **Secondary (`#006e2a`):** Used exclusively for "Success" and "Finalized" states. It represents the "green light" of a completed legal process.
*   **The "No-Line" Rule:** We explicitly prohibit 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts. 
    *   *Implementation:* A card using `surface_container_lowest` should sit on a background of `surface_container_low`. The contrast is felt, not seen.
*   **Surface Hierarchy & Nesting:** Treat the UI as stacked sheets of fine paper. 
    *   Base Layer: `surface`
    *   Section Layer: `surface_container_low`
    *   Active Component Layer: `surface_container_highest`
*   **The Glass & Gradient Rule:** For floating elements (Modals, Popovers), use a backdrop-blur (12px-20px) with a semi-transparent `surface_container_lowest`. For Hero CTAs, apply a subtle linear gradient from `primary` to `primary_container` at a 135-degree angle to add a "signature" soul to the button.

---

### 3. Typography: Editorial Authority
By using **Inter** with non-standard scale jumps, we create an editorial feel that communicates "High-Value Document."

*   **Display (lg/md/sm):** Used for landing pages or high-level dashboard summaries. These should be set with a slightly tighter letter-spacing (-0.02em) to look like a premium magazine title.
*   **Headline & Title:** Use `headline-lg` (2rem) for page titles. These must be bold and authoritative.
*   **Body (lg/md/sm):** `body-lg` (16px) is our workhorse. Ensure a line-height of 1.6 to allow the Indonesian text (which can have longer word strings) to breathe.
*   **Label:** Used for metadata. These should be uppercase with a +0.05em letter-spacing to provide a technical, "ledger-style" aesthetic.

---

### 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often "dirty." We use light and tone to create a sense of lift.

*   **The Layering Principle:** Avoid shadows on standard cards. Instead, use a `surface_container_lowest` card on a `surface_dim` background. The depth is achieved through color value, not artificial blur.
*   **Ambient Shadows:** For high-priority floating elements (e.g., a "Sign Here" prompt), use a multi-layered shadow:
    *   *Shadow:* `0px 4px 20px rgba(17, 28, 42, 0.06)` (using a tinted version of `on_surface`).
*   **The "Ghost Border" Fallback:** If a border is required for clarity in complex forms, use the `outline_variant` token at **20% opacity**. This creates a "suggestion" of a container without breaking the editorial flow.
*   **Glassmorphism:** Apply to navigation bars. Use `surface` at 80% opacity with a heavy backdrop-blur to allow content to peek through as the user scrolls, creating a sense of environmental continuity.

---

### 5. Components
Each component must feel "custom-built," not "drag-and-drop."

*   **Buttons (CTA Utama):**
    *   **Primary:** `primary` background with `on_primary` text. Border radius of `md` (12px). Use a subtle inner-glow (top border 1px, 10% white) to make it feel tactile.
    *   **Secondary:** `surface_container_highest` background. No border.
*   **Input Fields (Kolom Input):**
    *   Forbid high-contrast borders. Use `surface_container_high` as the background. On focus, transition to `primary` with a 2px "Ghost Border."
    *   *Language:* Use "Nama Lengkap sesuai KTP" or "Email Perusahaan" for clarity.
*   **Cards & Lists:**
    *   **No Dividers.** To separate list items, use a spacing of `spacing-4` (1rem) and a background shift of `surface_container_low` for every second item (zebra striping, but sophisticated).
*   **Signature Pad (Area Tanda Tangan):**
    *   The most important component. Use `surface_container_lowest` with a "Ghost Border." The "Sign" area should have a subtle watermark of the company logo at 5% opacity in the background.

---

### 6. Do’s and Don’ts

#### **Do:**
*   **Do** use asymmetrical margins. For example, a 2-column layout where the left column is 60% and the right is 30%, leaving 10% as a "spine" of white space.
*   **Do** use `Lucide-style` icons but at a thin 1.5px stroke weight to match the premium typography.
*   **Do** prioritize Bahasa Indonesia terms that sound professional (e.g., "Verifikasi Identitas" instead of just "Cek").

#### **Don’t:**
*   **Don’t** use 100% black `#000000`. Always use `on_surface` (`#111c2a`) for text to maintain a softer, high-end contrast.
*   **Don’t** use standard 4px border radii. Stick to the `DEFAULT` (8px) or `lg` (16px) to keep the "Modern Architect" feel.
*   **Don’t** use "Default Blue" for links. Use the `primary_container` with a custom underline (2px offset, 30% opacity).

---

### 7. Implementation Note
When building the dashboard, imagine you are designing a private bank application. Every interaction should feel intentional, every transition (use 300ms Ease-Out) should feel smooth, and the absence of borders should make the platform feel like a single, unified digital canvas.