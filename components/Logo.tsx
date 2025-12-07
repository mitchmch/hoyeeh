
import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon';
}

export const Logo: React.FC<LogoProps> = ({ className = "w-24 h-8", variant = 'full' }) => {
  return (
    <svg 
      className={className} 
      viewBox="0 0 200 60" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Icon: Play Button in African Pattern Style */}
      <rect x="0" y="5" width="50" height="50" rx="12" fill="url(#brandGradient)" />
      <path d="M18 15L38 30L18 45V15Z" fill="white" />
      
      {/* Text */}
      {variant === 'full' && (
        <path 
          d="M70 15H80V30H95V15H105V45H95V38H80V45H70V15ZM125 30C125 38.2843 118.284 45 110 45C101.716 45 95 38.2843 95 30C95 21.7157 101.716 15 110 15C118.284 15 125 21.7157 125 30ZM115 30C115 27.2386 112.761 25 110 25C107.239 25 105 27.2386 105 30C105 32.7614 107.239 35 110 35C112.761 35 115 32.7614 115 30ZM135 15H145L150 30L155 15H165L155 45H145L135 15ZM170 15H195V22H180V26H190V33H180V38H195V45H170V15ZM205 15H230V22H215V26H225V33H215V38H230V45H205V15Z" 
          fill="white" 
          transform="translate(0, 2)"
        />
      )}
      
      <defs>
        <linearGradient id="brandGradient" x1="0" y1="5" x2="50" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ea580c" /> {/* brand color */}
          <stop offset="1" stopColor="#c2410c" />
        </linearGradient>
      </defs>
    </svg>
  );
};
