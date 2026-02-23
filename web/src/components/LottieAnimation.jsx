import React, { useEffect, useRef } from 'react';
import Lottie from 'lottie-react';

const LottieAnimation = ({ 
  animationData, 
  width = 24, 
  height = 24, 
  loop = true, 
  autoplay = true,
  className = "",
  ...props 
}) => {
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <Lottie
        animationData={animationData}
        width={width}
        height={height}
        loop={loop}
        autoplay={autoplay}
        {...props}
      />
    </div>
  );
};

export default LottieAnimation;
