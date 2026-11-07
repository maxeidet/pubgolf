export function Title({
  children,
  size = "lg",
}: {
  children: React.ReactNode;
  size?: "sm" | "lg";
}) {
  const sm = size === "sm";
  return (
    <header className={sm ? "px-4 pt-2" : "px-4 pt-8"}>
      <div className={`${sm ? "h-1" : "h-1.5"} rounded-full bg-cream`} />
      <h1
        className={`text-center font-display font-bold uppercase leading-none tracking-tight text-brun ${
          sm ? "py-1 text-[2.1rem]" : "py-3 text-[clamp(2.75rem,15vw,5rem)]"
        }`}
      >
        {children}
      </h1>
      <div className={`${sm ? "h-1" : "h-1.5"} rounded-full bg-cream`} />
    </header>
  );
}

// Sun + green hill + flag, like the printed scorecard. Children sit on the grass.
export function Hill({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className="relative mt-auto overflow-hidden pt-28">
      <div className="absolute left-[6%] top-4 h-60 w-60 rounded-full bg-sol" />
      <div className="absolute inset-x-[-25%] bottom-0 top-24 rounded-t-[50%_90px] bg-gron" />
      <svg
        className="absolute right-[10%] top-0 h-40 w-16"
        viewBox="0 0 64 160"
        aria-hidden
      >
        <polygon points="8,6 60,20 8,34" fill="#F3EEDC" />
        <rect x="6" y="4" width="4" height="146" fill="#4A3420" />
        <ellipse cx="9" cy="152" rx="18" ry="6" fill="#4F6A37" />
      </svg>
      <div className={`relative px-4 pt-14 text-cream ${className || "pb-10"}`}>{children}</div>
    </div>
  );
}
