import { toast } from 'sonner';

export { toast };

export const useToast = () => {
  return {
    toast,
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    loading: (message: string) => toast.loading(message),
    dismiss: () => toast.dismiss()
  };
};
