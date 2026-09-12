import { Info } from 'lucide-solid';

export default function DescriptionBlock(props: { children: any }) {
  return (
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex gap-3 text-sm text-blue-800 dark:text-blue-200">
      <Info size={18} class="shrink-0 mt-0.5 text-blue-600 dark:text-blue-300" />
      <div class="space-y-1">{props.children}</div>
    </div>
  );
}
