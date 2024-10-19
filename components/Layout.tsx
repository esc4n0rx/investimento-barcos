// components/Layout.tsx
import React from 'react';
import Image from 'next/image';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen w-screen">
      <Image
        src="/boat-background.jpg"
        alt="Background Boat"
        layout="fill"
        objectFit="cover"
        quality={100}
      />
      
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white bg-opacity-20 backdrop-blur-md rounded-lg p-12 w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;

