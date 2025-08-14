
import React, { useEffect, useRef, CSSProperties } from 'react';

interface ParallaxBackgroundProps {
    strength?: number;
}

const ParallaxBackground: React.FC<ParallaxBackgroundProps> = ({ strength = 1 }) => {
    const backgroundRef = useRef<HTMLDivElement | null>(null);
    const bigBackgroundRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!backgroundRef.current) return;
            if (!bigBackgroundRef.current) return;

            const background = backgroundRef.current;
            const bigBackground = bigBackgroundRef.current;

            const x = e.clientX / window.innerWidth - 0.5;
            const y = e.clientY / window.innerHeight - 0.5;

            // If strength is 0, no parallax
            const s = Math.max(0, strength);
            background.style.transform = `translate(${-x * 0.3 * s}%, ${-y * 0.3 * s}%)`;
            bigBackground.style.transform = `translate(${-x * 0.6 * s}%, ${-y * 0.6 * s}%)`;
        };

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [strength]);

    const dottedBackgroundStyle: CSSProperties = {
        position: 'fixed',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        backgroundImage: 'radial-gradient(circle, rgb(230, 230, 230) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        zIndex: -1,
        transform: 'translate(0%, 0%)', // Initialize transformation
    };

    const bigDottedBackgroundStyle: CSSProperties = {
        position: 'fixed',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        backgroundImage: 'radial-gradient(circle,  rgb(230, 230, 230) 2px, transparent 1px)',
        backgroundSize: '100px 100px',
        zIndex: -1,
        transform: 'translate(0%, 0%)', // Initialize transformation
    };

    return (
        <>
            <div ref={backgroundRef} style={dottedBackgroundStyle}></div>
            <div ref={bigBackgroundRef} style={bigDottedBackgroundStyle}></div>
        </>
    );
};

export default ParallaxBackground;