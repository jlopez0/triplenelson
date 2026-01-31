# ⚠️ ACTION REQUIRED: Update Node.js

Your current Node.js version is **v14.18.1**, but Next.js 14 requires **Node.js v18.17.0 or later**.

## Steps to Fix

1.  **Download Node.js v20 (LTS)**:
    *   Go to [nodejs.org](https://nodejs.org/) and download the "LTS" version.
2.  **Install**: Run the installer.
3.  **Restart**: Close and reopen VS Code completely to refresh the terminal.
4.  **Verify**: Run `node -v` in the terminal. It should say `v18...` or `v20...`.
5.  **Clean Install**:
    Running the following commands will fix the "permission denied" errors:

    ```bash
    # PowerShell
    Remove-Item -Recurse -Force node_modules
    npm install
    ```

## Project Status

The **Techno / Brutalist** redesign has been fully implemented in the code:
*   **New Styles**: Acid Green (`#ccff00`) + Black palette, Brutalist grids, Custom cursor effects.
*   **New Fonts**: `Oswald` (Headers) and `JetBrains Mono` (Text).
*   **Components**:
    *   `TechnoButton`: Glitch/hover effects.
    *   `NoiseOverlay`: Film grain texture.
    *   `Countdown`: Large scale industrial timer.
*   **Pages Updated**: Home, Tickets (Aportar), Gallery, Contact, and FAQs.

Once Node is updated, run `npm run dev` to see the new site!
