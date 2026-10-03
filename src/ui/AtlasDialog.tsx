import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function AtlasDialog({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const invoker = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      invoker.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      invoker.current?.focus();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="atlas-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
