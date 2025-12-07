
import React, { useState } from 'react';
import { Button } from './Button';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialContentId?: string;
  initialTitle?: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialContentId, 
  initialTitle 
}) => {
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(initialContentId ? 'content_rating' : 'general');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        contentId: initialContentId,
        rating: rating > 0 ? rating : undefined,
        message,
        category,
        deviceInfo: navigator.userAgent
      });
      onClose();
      // Reset
      setRating(0);
      setMessage('');
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose}
      ></div>

      <div className="relative bg-[#181818] w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-scale-up border border-gray-800">
        <div className="p-6">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                 {initialContentId ? `Rate "${initialTitle}"` : 'Send Feedback'}
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
           </div>

           <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Star Rating for Content */}
              {initialContentId ? (
                 <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                       <button
                         key={star}
                         type="button"
                         onClick={() => setRating(star)}
                         className="focus:outline-none transition-transform hover:scale-110"
                       >
                         <svg 
                           className={`w-10 h-10 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} 
                           viewBox="0 0 24 24" 
                           stroke="currentColor" 
                           strokeWidth={star <= rating ? 0 : 2}
                         >
                           <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                         </svg>
                       </button>
                    ))}
                 </div>
              ) : (
                /* Category Selector for General Feedback */
                 <div>
                    <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Topic</label>
                    <select 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-black border border-gray-700 p-3 rounded text-white focus:border-brand focus:outline-none"
                    >
                       <option value="general">General Feedback</option>
                       <option value="bug">Report a Bug</option>
                       <option value="feature">Request a Feature</option>
                    </select>
                 </div>
              )}

              <div>
                <label className="block text-gray-400 text-xs uppercase font-bold mb-2">
                   {initialContentId ? 'Review (Optional)' : 'Message'}
                </label>
                <textarea 
                   required={!initialContentId}
                   value={message}
                   onChange={(e) => setMessage(e.target.value)}
                   className="w-full bg-black border border-gray-700 p-3 rounded text-white focus:border-brand focus:outline-none h-32 resize-none"
                   placeholder={initialContentId ? "What did you think?" : "Tell us how we can improve..."}
                />
              </div>

              <Button type="submit" fullWidth disabled={submitting}>
                 {submitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>
           </form>
        </div>
      </div>
    </div>
  );
};
