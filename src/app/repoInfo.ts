/**
 * Placeholder public repository URL — console only (not shown in product UI or README).
 * Update when the real GitHub repository is published.
 */
export const FUSION_REPO_URL = 'https://github.com/fearless9653/fusion'

/**
 * Startup console banner: clear hierarchy, bilingual ask, URL on its own line.
 * Tasteful spacing only — not shown in the product UI.
 */
export function logRepoInfo(): void {
  const banner = [
    '',
    '  Fusion',
    '  ──────',
    '  Local-first photo collage editor',
    '',
    '  If this project helps you, please consider starring or forking.',
    '  如果这个项目对你有帮助，欢迎 Star 或 Fork。',
    '',
    '  ' + FUSION_REPO_URL,
    '',
  ].join('\n')

  console.info(banner)
}
