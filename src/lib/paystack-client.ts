declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

/** Loads the Paystack inline script once, then resolves. */
export function loadPaystackScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load the Paystack checkout"));
    document.body.appendChild(script);
  });
}

/**
 * Opens the Paystack checkout for a checkout session that was started
 * server-side (startPaystackCheckout) and verifies the charge with the
 * existing verifyPaystackContribution server function once the customer
 * returns. This is the exact flow the app already used — just shared.
 */
export async function openPaystackCheckout(options: {
  publicKey: string;
  email: string;
  amount: number;
  reference: string;
  onVerified: (reference: string) => Promise<void> | void;
  onClose: () => void;
  onError: (message: string) => void;
}): Promise<void> {
  await loadPaystackScript();
  window.PaystackPop?.setup({
    key: options.publicKey,
    email: options.email,
    amount: Math.round(options.amount * 100),
    ref: options.reference,
    callback: async (response) => {
      try {
        await options.onVerified(response.reference);
      } catch (error) {
        options.onError(error instanceof Error ? error.message : "Payment could not be verified");
      }
    },
    onClose: options.onClose,
  }).openIframe();
}
