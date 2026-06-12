export default function BodyOutline() {
  return (
    <svg
      viewBox="0 0 120 220"
      data-testid="outline-body"
      className="h-[85%] w-auto opacity-80"
    >
      <circle
        cx="60" cy="30" r="16"
        fill="none" stroke="#ffd166" strokeWidth="2.5" strokeDasharray="7 5"
      />
      <path
        d="M60 48 L34 64 L28 132 L42 130 L42 204 L54 204 L57 142 L63 142 L66 204 L78 204 L78 130 L92 132 L86 64 Z"
        fill="none" stroke="#ffd166" strokeWidth="2.5" strokeDasharray="7 5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
