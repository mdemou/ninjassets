import type { Toast as ToastType } from "~/types";

interface ToastProps {
  toast: ToastType;
  onClose: (id: string) => void;
}

const bgClasses: Record<string, string> = {
  success: "bg-success text-white",
  error: "bg-danger text-white",
  warning: "bg-warning text-[#1a1a2e]",
  info: "bg-info text-white",
};

export function Toast({ toast, onClose }: ToastProps) {
  return (
    <div
      className={`flex items-start gap-2 p-4 rounded-lg shadow-md animate-toast-in ${bgClasses[toast.type]}`}
    >
      <div className="flex-1">
        <div className="font-semibold text-sm">{toast.title}</div>
        <div className="text-[0.8125rem] mt-0.5">{toast.message}</div>
        {toast.action && (
          <button
            className="mt-1.5 text-[0.8125rem] font-semibold underline underline-offset-2 bg-transparent border-none text-inherit cursor-pointer p-0 hover:opacity-90"
            onClick={() => {
              toast.action?.onClick();
              onClose(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        className="bg-transparent border-none text-inherit cursor-pointer text-lg leading-none opacity-80 hover:opacity-100 p-0"
        onClick={() => onClose(toast.id)}
      >
        &times;
      </button>
    </div>
  );
}
