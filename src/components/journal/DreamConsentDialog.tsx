import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { setDreamConsent } from "@/services/dreamService";

interface DreamConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
}

/** Asked once, before the first dream reflection or Dream patterns report. */
export const DreamConsentDialog = ({ open, onOpenChange, onAccept }: DreamConsentDialogProps) => {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dream.reflection.consent.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("dream.reflection.consent.body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("dream.reflection.consent.decline")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setDreamConsent();
              onAccept();
            }}
          >
            {t("dream.reflection.consent.accept")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
