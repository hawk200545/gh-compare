"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleToggle}
          className="relative h-10 w-10 rounded-full border-border/80 bg-background/80 shadow-sm backdrop-blur"
        >
          <SunMedium className="absolute h-5 w-5 rotate-0 scale-100 text-amber-500 transition-all dark:-rotate-90 dark:scale-0" />
          <MoonStar className="absolute h-5 w-5 rotate-90 scale-0 text-slate-200 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isDark ? "Switch to light" : "Switch to dark"}
      </TooltipContent>
    </Tooltip>
  );
}
