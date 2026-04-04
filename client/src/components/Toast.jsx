import { useState, useEffect } from 'react';

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    // Override window.alert
    const originalAlert = window.alert;
    window.alert = (message) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast animate-in">
          {t.message}
        </div>
      ))}
    </div>
  );
}
