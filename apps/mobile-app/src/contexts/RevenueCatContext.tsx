import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PRORATION_MODE,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useAuth } from './AuthContext';

export const PREMIUM_ENTITLEMENT_ID = 'premium';

export { PRORATION_MODE };

export interface PurchaseOptions {
  oldProductIdentifier?: string;
  prorationMode?: PRORATION_MODE;
}

const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

export type PaywallOutcome =
  | 'purchased'
  | 'restored'
  | 'cancelled'
  | 'error'
  | 'not_presented';

export type PurchaseOutcome =
  | { status: 'purchased'; customerInfo: CustomerInfo; productIdentifier: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

interface RevenueCatContextValue {
  ready: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  hasPremium: boolean;
  activeProductIdentifier: string | null;
  refresh: () => Promise<void>;
  purchasePackage: (
    pkg: PurchasesPackage,
    options?: PurchaseOptions,
  ) => Promise<PurchaseOutcome>;
  presentPaywall: () => Promise<PaywallOutcome>;
  presentPaywallIfNeeded: (
    entitlementId?: string,
  ) => Promise<PaywallOutcome>;
  presentCustomerCenter: () => Promise<void>;
  restorePurchases: () => Promise<CustomerInfo | null>;
}

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

export const useRevenueCat = (): RevenueCatContextValue => {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) {
    throw new Error('useRevenueCat must be used within RevenueCatProvider');
  }
  return ctx;
};

function pickApiKey(): string | undefined {
  return Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
}

function mapPaywallResult(result: PAYWALL_RESULT): PaywallOutcome {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return 'purchased';
    case PAYWALL_RESULT.RESTORED:
      return 'restored';
    case PAYWALL_RESULT.CANCELLED:
      return 'cancelled';
    case PAYWALL_RESULT.NOT_PRESENTED:
      return 'not_presented';
    case PAYWALL_RESULT.ERROR:
    default:
      return 'error';
  }
}

export const RevenueCatProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] =
    useState<PurchasesOffering | null>(null);
  const configuredRef = useRef(false);
  const lastSyncedUserIdRef = useRef<string | null>(null);

  const loadOfferings = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      setCurrentOffering(offerings.current ?? null);
    } catch (err) {
      console.warn('[RevenueCat] getOfferings failed:', err);
    }
  }, []);

  useEffect(() => {
    if (configuredRef.current) return;
    const apiKey = pickApiKey();
    if (!apiKey) {
      console.warn(
        `[RevenueCat] No API key configured for ${Platform.OS}; skipping configure.`,
      );
      return;
    }
    if (apiKey.startsWith('test_') && !__DEV__) {
      console.warn(
        '[RevenueCat] Test API key detected in a non-debug build; skipping configure to avoid SDK abort. ' +
          'Set a goog_/appl_ production key for release builds.',
      );
      return;
    }
    configuredRef.current = true;

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey });

    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);

    Purchases.getCustomerInfo()
      .then(setCustomerInfo)
      .catch((err) =>
        console.warn('[RevenueCat] initial getCustomerInfo failed:', err),
      );
    loadOfferings();
    setReady(true);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [loadOfferings]);

  useEffect(() => {
    if (!ready) return;
    const nextId = user?.id ?? null;
    if (lastSyncedUserIdRef.current === nextId) return;
    lastSyncedUserIdRef.current = nextId;

    (async () => {
      try {
        if (nextId) {
          const result = await Purchases.logIn(nextId);
          setCustomerInfo(result.customerInfo);
        } else {
          const info = await Purchases.logOut();
          setCustomerInfo(info);
        }
        await loadOfferings();
      } catch (err) {
        console.warn('[RevenueCat] identity sync failed:', err);
      }
    })();
  }, [ready, user?.id, loadOfferings]);

  const refresh = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      await loadOfferings();
    } catch (err) {
      console.warn('[RevenueCat] refresh failed:', err);
    }
  }, [loadOfferings]);

  const presentPaywall = useCallback(async (): Promise<PaywallOutcome> => {
    try {
      const result = currentOffering
        ? await RevenueCatUI.presentPaywall({ offering: currentOffering })
        : await RevenueCatUI.presentPaywall();
      const outcome = mapPaywallResult(result);
      if (outcome === 'purchased' || outcome === 'restored') {
        await refresh();
      }
      return outcome;
    } catch (err) {
      console.warn('[RevenueCat] presentPaywall failed:', err);
      return 'error';
    }
  }, [currentOffering, refresh]);

  const presentPaywallIfNeeded = useCallback(
    async (
      entitlementId: string = PREMIUM_ENTITLEMENT_ID,
    ): Promise<PaywallOutcome> => {
      try {
        const result = currentOffering
          ? await RevenueCatUI.presentPaywallIfNeeded({
              requiredEntitlementIdentifier: entitlementId,
              offering: currentOffering,
            })
          : await RevenueCatUI.presentPaywallIfNeeded({
              requiredEntitlementIdentifier: entitlementId,
            });
        const outcome = mapPaywallResult(result);
        if (outcome === 'purchased' || outcome === 'restored') {
          await refresh();
        }
        return outcome;
      } catch (err) {
        console.warn('[RevenueCat] presentPaywallIfNeeded failed:', err);
        return 'error';
      }
    },
    [currentOffering, refresh],
  );

  const presentCustomerCenter = useCallback(async () => {
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (err) {
      console.warn('[RevenueCat] presentCustomerCenter failed:', err);
    } finally {
      await refresh();
    }
  }, [refresh]);

  const purchasePackage = useCallback(
    async (
      pkg: PurchasesPackage,
      options?: PurchaseOptions,
    ): Promise<PurchaseOutcome> => {
      try {
        const googleProductChangeInfo = options?.oldProductIdentifier
          ? {
              oldProductIdentifier: options.oldProductIdentifier,
              prorationMode:
                options.prorationMode ??
                PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION,
            }
          : undefined;
        const result = await Purchases.purchasePackage(
          pkg,
          null, // upgradeInfo (deprecated, oldSKU-based)
          googleProductChangeInfo, // productChangeInfo — correct slot for oldProductIdentifier
        );
        setCustomerInfo(result.customerInfo);
        return {
          status: 'purchased',
          customerInfo: result.customerInfo,
          productIdentifier: result.productIdentifier,
        };
      } catch (err: any) {
        if (err?.userCancelled) {
          return { status: 'cancelled' };
        }
        console.warn('[RevenueCat] purchasePackage failed:', err);
        // TEMP DIAGNOSTIC: surface Google's underlying BillingResult so we can
        // pin down the product-change DEVELOPER_ERROR. Revert once resolved.
        const detail = [
          err?.code != null ? `code=${err.code}` : null,
          err?.readableErrorCode ? `rc=${err.readableErrorCode}` : null,
          err?.underlyingErrorMessage ??
            err?.userInfo?.underlyingErrorMessage ??
            null,
        ]
          .filter(Boolean)
          .join(' | ');
        return {
          status: 'error',
          message: detail || err?.message || 'Purchase failed',
        };
      }
    },
    [],
  );

  const restorePurchases = useCallback(async (): Promise<CustomerInfo | null> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info;
    } catch (err) {
      console.warn('[RevenueCat] restorePurchases failed:', err);
      return null;
    }
  }, []);

  const premiumEntitlement =
    customerInfo?.entitlements.active[PREMIUM_ENTITLEMENT_ID] ?? null;
  const hasPremium = !!premiumEntitlement;
  const activeProductIdentifier = premiumEntitlement
    ? premiumEntitlement.productPlanIdentifier
      ? `${premiumEntitlement.productIdentifier}:${premiumEntitlement.productPlanIdentifier}`
      : premiumEntitlement.productIdentifier
    : null;

  return (
    <RevenueCatContext.Provider
      value={{
        ready,
        customerInfo,
        currentOffering,
        hasPremium,
        activeProductIdentifier,
        refresh,
        purchasePackage,
        presentPaywall,
        presentPaywallIfNeeded,
        presentCustomerCenter,
        restorePurchases,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
};
