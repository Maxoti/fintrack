"use client";
import Modal from "./Modal";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation before any destructive action. */
export default function ConfirmModal({ open, title, message, confirmLabel, busy, error, onConfirm, onClose }: Props) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p>{message}</p>
      {error && (
        <p className="d-alert" role="alert">
          {error}
        </p>
      )}
      <div className="d-actions">
        <button type="button" className="d-btn" onClick={onClose} autoFocus>
          Cancel
        </button>
        <button type="button" className="d-btn d-btn--danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
