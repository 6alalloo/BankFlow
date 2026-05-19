import React from "react";
import { cn } from "../../lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, className }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-[#0f1012]/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] p-6 shadow-elevated",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
};

export { Modal };
