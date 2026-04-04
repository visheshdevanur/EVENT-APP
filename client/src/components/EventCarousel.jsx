import { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Netflix-style horizontally scrollable carousel with center-focus zoom.
 * Children are rendered as cards; the one closest to center gets the 'active' class.
 */
export default function EventCarousel({ children }) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const snapTimer = useRef(null);

  const items = Array.isArray(children) ? children : children ? [children] : [];

  const updateActive = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.offsetWidth / 2;
    const cards = el.querySelectorAll('.carousel-card');
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(center - cardCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  }, []);

  const snapToCenter = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll('.carousel-card');
    if (!cards.length) return;
    const card = cards[activeIndex];
    if (!card) return;
    const targetScroll = card.offsetLeft - el.offsetWidth / 2 + card.offsetWidth / 2;
    el.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }, [activeIndex]);

  const handleScroll = useCallback(() => {
    updateActive();
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => snapToCenter(), 150);
  }, [updateActive, snapToCenter]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    updateActive();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll, updateActive, items.length]);

  if (items.length === 0) return null;

  return (
    <div className="event-carousel-wrapper">
      <div className="event-carousel" ref={scrollRef}>
        {items.map((child, i) => (
          <div
            key={i}
            className={`carousel-card ${i === activeIndex ? 'carousel-card-active' : 'carousel-card-inactive'}`}
          >
            {child}
          </div>
        ))}
      </div>
      {/* Dot indicators */}
      {items.length > 1 && (
        <div className="carousel-dots">
          {items.map((_, i) => (
            <button
              key={i}
              className={`carousel-dot ${i === activeIndex ? 'carousel-dot-active' : ''}`}
              onClick={() => {
                setActiveIndex(i);
                const el = scrollRef.current;
                const cards = el?.querySelectorAll('.carousel-card');
                if (cards?.[i]) {
                  const targetScroll = cards[i].offsetLeft - el.offsetWidth / 2 + cards[i].offsetWidth / 2;
                  el.scrollTo({ left: targetScroll, behavior: 'smooth' });
                }
              }}
              aria-label={`Go to card ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
