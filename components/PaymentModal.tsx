
import React, { useState } from 'react';
import { User, PaymentMethod } from '../types';
import { AFRICAN_COUNTRIES, SUBSCRIPTION_PRICE, FLUTTERWAVE_PUBLIC_KEY } from '../constants';
import { Button } from './Button';

interface PaymentModalProps {
  user: User;
  onSuccess: () => void;
  onClose: () => void;
}

declare global {
  interface Window {
    FlutterwaveCheckout: any;
  }
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ user, onSuccess, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [planCycle, setPlanCycle] = useState<'monthly' | 'yearly'>('monthly');
  
  const isAfricanUser = AFRICAN_COUNTRIES.includes(user.country);
  const currency = isAfricanUser ? 'XAF' : 'USD';
  
  const basePrice = isAfricanUser ? SUBSCRIPTION_PRICE.AFRICA : SUBSCRIPTION_PRICE.INTERNATIONAL;
  // Apply 20% discount for yearly
  const amount = planCycle === 'monthly' ? basePrice : (basePrice * 12 * 0.8);

  const handleFlutterwavePayment = () => {
    setLoading(true);
    setStatus('processing');
    if (window.FlutterwaveCheckout) {
      window.FlutterwaveCheckout({
        public_key: FLUTTERWAVE_PUBLIC_KEY,
        tx_ref: Date.now(),
        amount: amount,
        currency: currency,
        payment_options: "card, mobilemoney, ussd",
        customer: {
          email: "user@hoyeeh.com",
          phone_number: user.mobileNumber,
          name: "Hoyeeh Subscriber",
        },
        customizations: {
          title: `Hoyeeh Premium (${planCycle === 'monthly' ? 'Monthly' : 'Yearly'})`,
          description: "Unlimited Streaming Access",
          logo: "https://picsum.photos/100/100", 
        },
        callback: function (data: any) {
          console.log("Payment success", data);
          setStatus('success');
          // Simulate backend verification delay
          setTimeout(() => {
            setLoading(false);
            onSuccess();
          }, 1500);
        },
        onclose: function() {
          setLoading(false);
          setStatus('idle');
        }
      });
    } else {
      alert("Flutterwave SDK not loaded");
      setLoading(false);
      setStatus('idle');
    }
  };

  const handleStripePayment = () => {
    setLoading(true);
    setStatus('processing');
    setTimeout(() => {
        // Mock Stripe success
        setStatus('success');
        setTimeout(() => {
            onSuccess();
        }, 1500);
    }, 2000);
  };

  if (status === 'success') {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-dark-card border border-brand/50 rounded-xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-fade-in">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 text-white">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
                <p className="text-gray-300">Welcome to Premium.</p>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-dark-card border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand/20 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none"></div>

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <h2 className="text-2xl font-bold mb-2 text-white">Upgrade to Premium</h2>
        <p className="text-gray-400 mb-6 text-sm">
          Unlock unlimited African movies, originals, and international series.
        </p>

        {/* Plan Toggle */}
        <div className="flex bg-gray-800 p-1 rounded-lg mb-6 relative">
             <button 
                onClick={() => setPlanCycle('monthly')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all z-10 ${planCycle === 'monthly' ? 'text-white bg-gray-700 shadow' : 'text-gray-400'}`}
             >
                Monthly
             </button>
             <button 
                onClick={() => setPlanCycle('yearly')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all z-10 ${planCycle === 'yearly' ? 'text-white bg-brand shadow' : 'text-gray-400'}`}
             >
                Yearly <span className="text-[10px] bg-white text-brand px-1 rounded ml-1">-20%</span>
             </button>
        </div>
        
        <div className="bg-gray-800/50 p-6 rounded-xl mb-6 border border-gray-700 relative">
          {planCycle === 'yearly' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Best Value
              </div>
          )}
          <div className="text-center">
              <span className="text-4xl font-bold text-white">
                {isAfricanUser ? `${amount.toLocaleString()} FCFA` : `$${amount.toFixed(2)}`}
              </span>
              <span className="text-gray-400 text-sm block mt-1">
                  billed {planCycle}
              </span>
          </div>
        </div>

        {isAfricanUser ? (
          <div className="space-y-4">
            <Button onClick={handleFlutterwavePayment} fullWidth disabled={loading}>
              {loading ? 'Processing...' : `Pay ${amount.toLocaleString()} FCFA`}
            </Button>
            <div className="flex justify-center gap-4 grayscale opacity-60">
               {/* Simplified Text Icons */}
               <div className="flex flex-col items-center">
                   <div className="w-8 h-8 rounded bg-yellow-500 flex items-center justify-center text-[8px] font-bold text-black">MTN</div>
               </div>
               <div className="flex flex-col items-center">
                   <div className="w-8 h-8 rounded bg-orange-500 flex items-center justify-center text-[8px] font-bold text-black">ORANGE</div>
               </div>
               <div className="flex flex-col items-center">
                   <div className="w-8 h-8 rounded bg-blue-800 flex items-center justify-center text-[8px] font-bold text-white">VISA</div>
               </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Button onClick={handleStripePayment} fullWidth disabled={loading}>
              {loading ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
            </Button>
            <p className="text-center text-xs text-gray-500">Secured by Stripe</p>
          </div>
        )}
      </div>
    </div>
  );
};
