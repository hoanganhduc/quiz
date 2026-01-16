import { Link } from "react-router-dom";

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="mt-auto border-t border-border py-8 px-4 text-center">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="space-y-1">
                    <h2 className="text-sm font-bold text-text">Quiz Platform</h2>
                    <p className="text-xs text-textMuted max-w-md mx-auto">
                        Browse and submit public quizzes with secure authentication.
                    </p>
                </div>

                <div className="text-xs text-textMuted">
                    Built with assistance from Google Antigravity, GitHub Copilot, and ChatGPT Codex.
                </div>

                <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-xs text-textMuted">
                    <span>&copy; {currentYear} Duc A. Hoang.</span>
                    <span>
                        License:{" "}
                        <a
                            href="https://github.com/hoanganhduc/quiz/blob/main/LICENSE"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-info hover:underline"
                        >
                            MIT
                        </a>
                        .
                    </span>
                    <a
                        href="https://github.com/hoanganhduc/quiz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-info hover:underline"
                    >
                        Source
                    </a>
                </div>
            </div>
        </footer>
    );
}
