# Создай папку если нет
mkdir -p src/components/ui

# Создай файл
cat > src/components/ui/progress-bar.tsx << 'EOF'
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ 
  value, 
  max = 100, 
  label, 
  className,
  showPercentage = true 
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  return (
    <div className={cn("w-full", className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          {label && <span>{label}</span>}
          {showPercentage && <span>{Math.floor(percentage)}%</span>}
        </div>
      )}
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
EOF