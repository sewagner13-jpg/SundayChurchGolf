import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", ...props }, ref) => {
    const baseStyles =
      "font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed tap-target";

    const variantStyles = {
      primary: "bg-green-600 text-white hover:bg-green-700 active:bg-green-800",
      secondary:
        "bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400",
      danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
      ghost: "bg-transparent hover:bg-gray-100 text-gray-700",
    };

    const sizeStyles = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
