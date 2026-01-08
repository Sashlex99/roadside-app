// Mock implementation of @stripe/stripe-react-native for web platform
// This prevents Metro bundling errors when running on web

// React component mock
const StripeProvider = ({ children }) => children;

// Hook mocks
const useStripe = () => ({
  initPaymentSheet: () => Promise.resolve({ error: null }),
  presentPaymentSheet: () => Promise.resolve({ error: { message: 'Stripe not available on web' } }),
});

const usePaymentSheet = () => ({
  initPaymentSheet: () => Promise.resolve({ error: null }),
  presentPaymentSheet: () => Promise.resolve({ error: { message: 'Stripe not available on web' } }),
  loading: false,
});

// Component mock
const CardField = ({ children, ...props }) => null;

// Export for both CommonJS and ES modules
module.exports = {
  StripeProvider,
  useStripe,
  usePaymentSheet,
  CardField,
};

// ES module exports
module.exports.default = {
  StripeProvider,
  useStripe,
  usePaymentSheet,
  CardField,
};

// Named exports for ES modules
module.exports.StripeProvider = StripeProvider;
module.exports.useStripe = useStripe;
module.exports.usePaymentSheet = usePaymentSheet;
module.exports.CardField = CardField; 