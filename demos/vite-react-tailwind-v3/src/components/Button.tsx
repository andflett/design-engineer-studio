const styles = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

export function Button({ variant = "primary", children, ...props }: {
  variant?: keyof typeof styles;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button data-slot="button" className={`rounded-md px-lg py-sm text-sm font-medium ${styles[variant]}`} {...props}>
      {children}
    </button>
  );
}
