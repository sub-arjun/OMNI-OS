import { useCustomToast } from '../renderer/components/CustomToast';

// Re-export the custom toast hook
export default function useToast() {
  return useCustomToast();
}
