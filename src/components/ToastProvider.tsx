import type { ReactNode, FC } from "react";

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: FC<ToastProviderProps> = ({ children }) => {
  return <>{children}</>;
};
