import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { DarkModeProvider, useDarkMode } from '@/components/dark-mode-provider';

function DarkModeToggle() {
  const { isDark, toggle } = useDarkMode();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="fixed top-4 right-4"
    >
      {isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
}

export default function HomePage() {
  return (
    <DarkModeProvider>
      <main className="min-h-screen flex flex-col items-center justify-center p-24 transition-colors duration-200">
        <DarkModeToggle />
        <h1 className="text-4xl font-bold mb-8">Feedback-to-Code Engine</h1>
        {/* Rest of your front page content */}
      </main>
    </DarkModeProvider>
  );
}