import { useEffect, useRef } from 'react';

const useGameLoop = (callback) => {
    const requestRef = useRef();
    const previousTimeRef = useRef();

    const loop = (time) => {
        if (previousTimeRef.current != null) {
            const deltaTime = time - previousTimeRef.current;
            callback(deltaTime);
        }
        previousTimeRef.current = time;
        requestRef.current = requestAnimationFrame(loop);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestRef.current);
    }, []);
};

export default useGameLoop;