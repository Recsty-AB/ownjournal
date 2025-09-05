import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CurrencyCode, PRICING_BY_CURRENCY } from "@/config/pricing";
import { detectUserCurrency } from "@/utils/locationPricing";

interface LocalizedPricing {
  currency: CurrencyCode;
  yearlyPrice: string;
  monthlyPrice: string;
  yearlyAmount: number;
  monthlyAmount: number;
  isDetecting: boolean;
}

/**
 * Hook that provides localized pricing based on user's location
 * Uses a cascading detection strategy: Cache → IP → Timezone → Language
 */
export function useLocalizedPricing(): LocalizedPricing {
  const { i18n } = useTranslation();
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    let mounted = true;

    const detect = async () => {
      try {
        const detectedCurrency = await detectUserCurrency(i18n.language);
        if (mounted) {
          setCurrency(detectedCurrency);
        }
      } catch (error) {
        console.error("Error detecting currency:", error);
        // Keep default USD on error
      } finally {
        if (mounted) {
          setIsDetecting(false);
        }
      }
    };

    detect();

    return () => {
      mounted = false;
    };
  }, [i18n.language]);

  const pricing = PRICING_BY_CURRENCY[currency];

  return {
    currency,
    yearlyPrice: pricing.yearly,
    monthlyPrice: pricing.monthly,
    yearlyAmount: pricing.yearlyAmount,
    monthlyAmount: pricing.monthlyAmount,
    isDetecting,
  };
}
