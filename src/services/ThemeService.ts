export class ThemeService {
  private static THEME_KEY = 'preferred-theme';

  public static initialize(): void {
    const savedTheme = localStorage.getItem(this.THEME_KEY) || 'light';
    this.setTheme(savedTheme);
    this.setupThemeToggle();
  }

  public static setTheme(theme: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.THEME_KEY, theme);
  }

  private static setupThemeToggle(): void {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        this.setTheme(currentTheme === 'light' ? 'dark' : 'light');
      });
    }
  }
}