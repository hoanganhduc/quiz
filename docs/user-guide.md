# Student Guide

**Last verified: 2026-01-08**

(Screenshot: Home page with exam link)

## 1) Overview

- This app uses a public UI (GitHub Pages) with a Cloudflare Worker backend.
- Your **submission** is stored by the backend when you click **Submit answers**.
- While you are taking an exam, the UI may also **auto-save your in-progress answers in your browser** (localStorage) so you can refresh without losing work.

## 2) How to start an exam

1) Open your exam link: `/#/exam/<examId>`.
2) The **Sticky Header** shows the exam ID and subject and includes a progress/status area.
3) Questions appear as **Question Cards**.
4) The right-side **Summary Card** shows answered/remaining counts and a **Progress Bar**.

(Screenshot: Sticky Header + Summary Card + Question Cards)

## 3) Login and identity modes (policy-based)

In the **Authentication Accordion**, you may see:
- **GitHub Login**
- **Google Login**
- **Continue anonymously** (only when the exam policy allows optional login)

Notes:
- Sessions are cookie-based.
- Some exams use **per-student versions**. In those cases, the UI may create/use an anonymous session so you keep a consistent version across refreshes.

(Screenshot: Authentication Accordion with GitHub/Google/Continue anonymously)

## 4) Access codes (if enabled)

In the **Access codes Accordion**, an exam may require:
- **View code**: required to click **Load questions**.
- **Submit code**: required to click **Submit answers**.

Behavior:
- Codes are verified by the backend.
- Wrong/missing codes show an **Alert** and the action is blocked.

(Screenshot: Access codes Accordion with View code + Submit code inputs)

## 5) Answering questions

- Each question is a **Question Card** with button-like multiple-choice options.
- As you answer, the **Summary Card** updates and shows answered/remaining.
- Jump between questions using the **Jump to question** buttons in the Summary Card.

Keyboard shortcuts (inside a question):
- `A`/`B`/`C`/`D` selects that option.
- Arrow keys move focus between options.
- `Enter` or `Space` selects the focused option.

(Screenshot: Question Card with choices + Answered/Unanswered Badge)

## 6) Saving progress (drafts)

Once questions are loaded, the UI auto-saves your answers in your browser (localStorage) keyed by exam/version.

- If a saved draft is found, you may see an **Alert** like “Restored saved answers.”
- You can clear local progress using **Clear saved draft** in the Summary Card.

> Drafts are stored only on your current device/browser.

(Screenshot: “Restored saved answers” Alert + Clear saved draft button)

## 7) Submitting

- Use **Submit answers** (in the right-side Summary Card).
- On mobile, use the **Floating Action Bar** (it includes code inputs when required and a primary **Submit** button).

After submit:
- You should see a success **Alert** (e.g. “Submission recorded.”).
- The Summary Card shows your **Score: correct/total**.
- Each Question Card shows a correctness **Badge** (Correct/Incorrect).

(Screenshot: Submission success Alert + Score in Summary Card)

## 8) Solutions policy (what students will see)

The backend exam policy includes a `solutionsMode` (for example, `never`, `after_submit`, `always`).

**Current UI behavior (as of 2026-01-08):**
- The student UI shows **score and correctness**, but it does **not** display worked solutions in the question cards.

## 9) For instructors/admins

For source/secret management and CI bank generation, see:
- `docs/sources-admin.md`
