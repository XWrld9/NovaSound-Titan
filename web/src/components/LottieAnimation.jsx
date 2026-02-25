import React from 'react';
import Lottie from 'lottie-react';

const LottieAnimation = ({ 
  animationData, 
  width = 24, 
  height = 24, 
  loop = true, 
  autoplay = true,
  className = "",
  style,
  ...props 
}) => {
  const lottieStyle = style || { width, height };
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <Lottie
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        style={lottieStyle}
        {...props}
      />
    </div>
  );
};

export default LottieAnimation;
