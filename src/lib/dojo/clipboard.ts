import { toast } from "sonner";

export async function copyText(text: string, label: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()} — your browser blocked clipboard access`);
  }
}